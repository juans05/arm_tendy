'use client';
import { createContext, useContext } from 'react';
import { Miembro } from './api';

export const MiembroCtx = createContext<{ miembro: Miembro; empresa: string } | null>(null);
export const useMiembro = () => useContext(MiembroCtx)!;
