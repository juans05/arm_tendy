'use client';
// Adaptado de warike_administrativo/apps/dashboard/components/FacebookWhatsAppConnect.tsx.
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export interface ConfigMeta {
  configurado: boolean;
  appId: string;
  configId: string;
  graphVersion: string;
}

function cargarSdk(appId: string, version: string): Promise<void> {
  return new Promise((ok, falla) => {
    if (window.FB) return ok();
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      ok();
    };
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script');
      s.id = 'facebook-jssdk';
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.onerror = () => falla(new Error('No se pudo cargar Facebook'));
      document.body.appendChild(s);
    }
  });
}

// Embedded Signup de Meta: el gerente entra con Facebook, elige su cuenta y número de WhatsApp Business,
// y Meta devuelve un código + los IDs. La API de ARM hace el resto (incluida la redirección del webhook).
export default function ConectarWhatsapp({ config, onConectado }: { config: ConfigMeta; onConectado: (telefono: string) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  // FB.login y el mensaje de Embedded Signup llegan por canales distintos y en cualquier orden.
  const sesion = useRef<{ code?: string; wabaId?: string; phoneNumberId?: string; coexistencia?: boolean }>({});

  const intentarCompletar = async () => {
    const { code, wabaId, phoneNumberId, coexistencia } = sesion.current;
    // En coexistencia Meta puede no mandar el número: la API lo busca en la cuenta.
    if (!code || !wabaId || (!phoneNumberId && !coexistencia)) return;
    sesion.current = {};
    const r = await api<{ telefono: string }>('/canales/whatsapp/conectar', {
      method: 'POST',
      body: JSON.stringify({ code, wabaId, phoneNumberId, coexistencia }),
    });
    setOcupado(false);
    if (r.data) onConectado(r.data.telefono);
    else setError(r.message ?? 'No se pudo conectar el número');
  };

  useEffect(() => {
    const alMensaje = (e: MessageEvent) => {
      const host = (() => {
        try {
          return new URL(e.origin).hostname;
        } catch {
          return '';
        }
      })();
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          sesion.current.wabaId = data.data?.waba_id;
          sesion.current.phoneNumberId = data.data?.phone_number_id;
          if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') sesion.current.coexistencia = true;
          intentarCompletar();
        } else if (data.event === 'CANCEL') {
          sesion.current = {};
          setOcupado(false);
        }
      } catch {
        /* mensajes de Facebook que no son JSON */
      }
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empezar = async (coexistencia: boolean) => {
    setError('');
    setOcupado(true);
    sesion.current = { coexistencia };
    try {
      await cargarSdk(config.appId, config.graphVersion);
      window.FB.login(
        (res: any) => {
          const code = res?.authResponse?.code;
          if (!code) return setOcupado(false); // cerró la ventana o no aceptó
          sesion.current.code = code;
          intentarCompletar();
        },
        {
          config_id: config.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, featureType: coexistencia ? 'whatsapp_business_app_onboarding' : '', sessionInfoVersion: '3' },
        },
      );
    } catch {
      setOcupado(false);
      setError('No se pudo abrir Facebook');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => empezar(true)}
          disabled={ocupado}
          className="rounded-2xl border-2 border-mango bg-mango-suave p-4 text-left transition hover:bg-mango/30 disabled:opacity-50"
        >
          <p className="font-display text-lg font-bold">Ya uso WhatsApp Business en el celular</p>
          <p className="mt-1 text-sm text-gris">Sigues usando la app del celular y ARM recibe los mismos mensajes.</p>
        </button>
        <button
          onClick={() => empezar(false)}
          disabled={ocupado}
          className="rounded-2xl border-2 border-linea bg-white p-4 text-left transition hover:border-tinta disabled:opacity-50"
        >
          <p className="font-display text-lg font-bold">Conectar un número nuevo</p>
          <p className="mt-1 text-sm text-gris">Un número que todavía no está en ninguna app de WhatsApp.</p>
        </button>
      </div>
      {ocupado && <p className="text-sm text-gris">Sigue los pasos en la ventana de Facebook…</p>}
      {error && <p className="text-sm text-peligro">{error}</p>}
    </div>
  );
}
