import { MigrationInterface, QueryRunner } from 'typeorm';

// Bloques 4 a 6: historial del embudo, calendario con citas sin cruces, seguimiento, alertas y plantillas.
export class EmbudoCalendarioSeguimiento1793920000000 implements MigrationInterface {
  name = 'EmbudoCalendarioSeguimiento1793920000000';

  public async up(q: QueryRunner): Promise<void> {
    // Necesaria para impedir en la base que un comercial tenga dos citas que se cruzan.
    await q.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await q.query(`ALTER TABLE "leads"
      ADD "traspaso_en" TIMESTAMP WITH TIME ZONE,
      ADD "traspaso_motivo" character varying(20),
      ADD "seguimiento_paso" integer NOT NULL DEFAULT 0,
      ADD "seguimiento_proximo" TIMESTAMP WITH TIME ZONE,
      ADD "horarios_ofrecidos" jsonb`);
    await q.query(
      `CREATE INDEX "IDX_leads_seguimiento" ON "leads" ("seguimiento_proximo") WHERE "seguimiento_proximo" IS NOT NULL`,
    );

    await q.query(`CREATE TABLE "lead_historial" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
      "de" character varying(20),
      "a" character varying(20) NOT NULL,
      "miembro_id" uuid REFERENCES "miembros"("id") ON DELETE SET NULL,
      "en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_historial_tenant_en" ON "lead_historial" ("tenant", "en")`,
    );
    await q.query(
      `CREATE INDEX "IDX_historial_lead" ON "lead_historial" ("lead_id")`,
    );

    await q.query(
      `ALTER TABLE "contactos" ADD "no_contactar" boolean NOT NULL DEFAULT false`,
    );
    await q.query(
      `ALTER TABLE "conversaciones" ADD "alerta_nivel" smallint NOT NULL DEFAULT 0`,
    );
    await q.query(
      `ALTER TABLE "miembros" ADD "alertas_off" jsonb NOT NULL DEFAULT '[]'`,
    );

    await q.query(`ALTER TABLE "empresas_config"
      ADD "zona_horaria" character varying(50) NOT NULL DEFAULT 'America/Lima',
      ADD "margen_citas_min" integer NOT NULL DEFAULT 10,
      ADD "seguimiento_dias_1" integer NOT NULL DEFAULT 3,
      ADD "seguimiento_dias_2" integer NOT NULL DEFAULT 7,
      ADD "minutos_sin_atender" integer NOT NULL DEFAULT 15,
      ADD "plantilla_seguimiento" character varying(100),
      ADD "plantilla_recordatorio" character varying(100),
      ADD "plantilla_alerta" character varying(100),
      ADD "idioma_plantillas" character varying(10) NOT NULL DEFAULT 'es',
      ADD "resumen_enviado" date`);

    await q.query(`CREATE TABLE "horarios" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "miembro_id" uuid NOT NULL REFERENCES "miembros"("id") ON DELETE CASCADE,
      "dia" smallint NOT NULL CHECK ("dia" BETWEEN 0 AND 6),
      "desde" time NOT NULL,
      "hasta" time NOT NULL,
      CHECK ("desde" < "hasta")
    )`);
    await q.query(
      `CREATE INDEX "IDX_horarios_miembro" ON "horarios" ("miembro_id")`,
    );

    await q.query(`CREATE TABLE "bloqueos" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "miembro_id" uuid NOT NULL REFERENCES "miembros"("id") ON DELETE CASCADE,
      "inicio" TIMESTAMP WITH TIME ZONE NOT NULL,
      "fin" TIMESTAMP WITH TIME ZONE NOT NULL,
      "motivo" text NOT NULL DEFAULT '',
      CHECK ("inicio" < "fin")
    )`);
    await q.query(
      `CREATE INDEX "IDX_bloqueos_miembro_inicio" ON "bloqueos" ("miembro_id", "inicio")`,
    );

    await q.query(`CREATE TABLE "citas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
      "miembro_id" uuid NOT NULL REFERENCES "miembros"("id") ON DELETE CASCADE,
      "inicio" TIMESTAMP WITH TIME ZONE NOT NULL,
      "fin" TIMESTAMP WITH TIME ZONE NOT NULL,
      "estado" character varying(12) NOT NULL DEFAULT 'agendada',
      "origen" character varying(10) NOT NULL DEFAULT 'manual',
      "titulo" character varying(200) NOT NULL DEFAULT 'Demo',
      "link" text,
      "notas" text,
      "aviso_30" boolean NOT NULL DEFAULT false,
      "rec_24" boolean NOT NULL DEFAULT false,
      "rec_2" boolean NOT NULL DEFAULT false,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CHECK ("inicio" < "fin"),
      CONSTRAINT "citas_sin_cruce" EXCLUDE USING gist ("miembro_id" WITH =, tstzrange("inicio", "fin") WITH &&) WHERE ("estado" = 'agendada')
    )`);
    await q.query(
      `CREATE INDEX "IDX_citas_tenant_inicio" ON "citas" ("tenant", "inicio")`,
    );

    await q.query(`CREATE TABLE "alertas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "miembro_id" uuid NOT NULL REFERENCES "miembros"("id") ON DELETE CASCADE,
      "tipo" character varying(30) NOT NULL,
      "titulo" character varying(200) NOT NULL,
      "detalle" text NOT NULL DEFAULT '',
      "enlace" character varying(300),
      "leida" boolean NOT NULL DEFAULT false,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_alertas_miembro" ON "alertas" ("miembro_id", "leida", "created_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "alertas"`);
    await q.query(`DROP TABLE "citas"`);
    await q.query(`DROP TABLE "bloqueos"`);
    await q.query(`DROP TABLE "horarios"`);
    await q.query(`ALTER TABLE "empresas_config" DROP COLUMN "zona_horaria", DROP COLUMN "margen_citas_min", DROP COLUMN "seguimiento_dias_1",
      DROP COLUMN "seguimiento_dias_2", DROP COLUMN "minutos_sin_atender", DROP COLUMN "plantilla_seguimiento",
      DROP COLUMN "plantilla_recordatorio", DROP COLUMN "plantilla_alerta", DROP COLUMN "idioma_plantillas", DROP COLUMN "resumen_enviado"`);
    await q.query(`ALTER TABLE "miembros" DROP COLUMN "alertas_off"`);
    await q.query(`ALTER TABLE "conversaciones" DROP COLUMN "alerta_nivel"`);
    await q.query(`ALTER TABLE "contactos" DROP COLUMN "no_contactar"`);
    await q.query(`DROP TABLE "lead_historial"`);
    await q.query(`DROP INDEX "IDX_leads_seguimiento"`);
    await q.query(`ALTER TABLE "leads" DROP COLUMN "traspaso_en", DROP COLUMN "traspaso_motivo", DROP COLUMN "seguimiento_paso",
      DROP COLUMN "seguimiento_proximo", DROP COLUMN "horarios_ofrecidos"`);
  }
}
