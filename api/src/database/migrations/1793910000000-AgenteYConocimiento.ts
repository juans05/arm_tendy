import { MigrationInterface, QueryRunner } from 'typeorm';

// Bloque 3: configuración del agente, leads, base de conocimiento (pgvector), preguntas sin respuesta y traza de la IA.
export class AgenteYConocimiento1793910000000 implements MigrationInterface {
  name = 'AgenteYConocimiento1793910000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "empresas_config" (
      "tenant" character varying(200) PRIMARY KEY,
      "agente_modo" character varying(10) NOT NULL DEFAULT 'responde',
      "agente_nombre" character varying(60) NOT NULL DEFAULT 'Asistente',
      "agente_tono" text NOT NULL DEFAULT '',
      "producto" text NOT NULL DEFAULT ''
    )`);

    await q.query(`ALTER TABLE "conversaciones" ADD "borrador" text`);

    await q.query(`CREATE TABLE "leads" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "conversacion_id" uuid NOT NULL UNIQUE REFERENCES "conversaciones"("id") ON DELETE CASCADE,
      "contacto_id" uuid NOT NULL REFERENCES "contactos"("id") ON DELETE CASCADE,
      "linea_id" uuid REFERENCES "lineas_producto"("id") ON DELETE SET NULL,
      "etapa" character varying(20) NOT NULL DEFAULT 'nuevo',
      "etapa_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "calificado" boolean NOT NULL DEFAULT false,
      "puntaje" integer NOT NULL DEFAULT 0,
      "datos" jsonb NOT NULL DEFAULT '{}',
      "sugerencias" jsonb NOT NULL DEFAULT '[]',
      "dueno_id" uuid REFERENCES "miembros"("id") ON DELETE SET NULL,
      "motivo" text,
      "monto" numeric(12,2),
      "plan" character varying(100),
      "referral" jsonb,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_leads_tenant_etapa" ON "leads" ("tenant", "etapa")`,
    );

    await q.query(`CREATE TABLE "conocimiento_docs" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "titulo" character varying(200) NOT NULL,
      "tipo" character varying(10) NOT NULL,
      "texto" text NOT NULL,
      "archivo" bytea,
      "mime" character varying(100),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_docs_tenant" ON "conocimiento_docs" ("tenant")`,
    );

    await q.query(`CREATE TABLE "conocimiento_fragmentos" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "doc_id" uuid NOT NULL REFERENCES "conocimiento_docs"("id") ON DELETE CASCADE,
      "texto" text NOT NULL,
      "embedding" vector(1536)
    )`);
    await q.query(
      `CREATE INDEX "IDX_fragmentos_tenant" ON "conocimiento_fragmentos" ("tenant")`,
    );
    await q.query(
      `CREATE INDEX "IDX_fragmentos_embedding" ON "conocimiento_fragmentos" USING hnsw ("embedding" vector_cosine_ops)`,
    );

    await q.query(`CREATE TABLE "preguntas" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "conversacion_id" uuid REFERENCES "conversaciones"("id") ON DELETE SET NULL,
      "pregunta" text NOT NULL,
      "respuesta" text,
      "estado" character varying(12) NOT NULL DEFAULT 'abierta',
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_preguntas_tenant_estado" ON "preguntas" ("tenant", "estado")`,
    );

    await q.query(`CREATE TABLE "ejecuciones_ia" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "tenant" character varying(200) NOT NULL,
      "conversacion_id" uuid REFERENCES "conversaciones"("id") ON DELETE CASCADE,
      "tipo" character varying(20) NOT NULL,
      "modelo" character varying(100),
      "tokens_entrada" integer NOT NULL DEFAULT 0,
      "tokens_salida" integer NOT NULL DEFAULT 0,
      "ms" integer NOT NULL DEFAULT 0,
      "salida" jsonb,
      "error" text,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    )`);
    await q.query(
      `CREATE INDEX "IDX_ejecuciones_conv" ON "ejecuciones_ia" ("conversacion_id", "created_at")`,
    );
    await q.query(
      `CREATE INDEX "IDX_ejecuciones_tenant_fecha" ON "ejecuciones_ia" ("tenant", "created_at")`,
    );

    // Auditoría M4: la bandeja lista por empresa y fecha del último mensaje.
    await q.query(
      `CREATE INDEX "IDX_conversaciones_tenant_ultimo" ON "conversaciones" ("tenant", "ultimo_mensaje_en" DESC)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_conversaciones_tenant_ultimo"`);
    await q.query(`DROP TABLE "ejecuciones_ia"`);
    await q.query(`DROP TABLE "preguntas"`);
    await q.query(`DROP TABLE "conocimiento_fragmentos"`);
    await q.query(`DROP TABLE "conocimiento_docs"`);
    await q.query(`DROP TABLE "leads"`);
    await q.query(`ALTER TABLE "conversaciones" DROP COLUMN "borrador"`);
    await q.query(`DROP TABLE "empresas_config"`);
  }
}
