import { MigrationInterface, QueryRunner } from 'typeorm';

export class Actividad1793940000000 implements MigrationInterface {
  name = 'Actividad1793940000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "notas" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
      "autor_id" uuid NOT NULL,
      "texto" text NOT NULL,
      "menciones" uuid array NOT NULL DEFAULT '{}',
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_notas" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_notas_lead" ON "notas" ("lead_id")`);
    await q.query(`CREATE TABLE "tareas" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
      "titulo" character varying(200) NOT NULL,
      "vence_en" TIMESTAMP WITH TIME ZONE,
      "responsable_id" uuid NOT NULL,
      "creador_id" uuid,
      "estado" character varying(10) NOT NULL DEFAULT 'pendiente',
      "origen" character varying(10) NOT NULL DEFAULT 'manual',
      "hecha_en" TIMESTAMP WITH TIME ZONE,
      "aviso_vencida" boolean NOT NULL DEFAULT false,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_tareas" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_tareas_lead" ON "tareas" ("lead_id")`);
    await q.query(
      `CREATE INDEX "IDX_tareas_pendientes" ON "tareas" ("responsable_id", "vence_en") WHERE estado = 'pendiente'`,
    );
    await q.query(`CREATE TABLE "vistas" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "miembro_id" uuid NOT NULL,
      "nombre" character varying(60) NOT NULL,
      "filtros" jsonb NOT NULL DEFAULT '{}',
      "compartida" boolean NOT NULL DEFAULT false,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_vistas" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_vistas_tenant" ON "vistas" ("tenant")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "vistas"`);
    await q.query(`DROP TABLE "tareas"`);
    await q.query(`DROP TABLE "notas"`);
  }
}
