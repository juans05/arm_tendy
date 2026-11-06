import { MigrationInterface, QueryRunner } from 'typeorm';

export class CuentasAnuncios1793930000000 implements MigrationInterface {
  name = 'CuentasAnuncios1793930000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "cuentas_anuncios" (
      "tenant" character varying(200) NOT NULL,
      "cuenta_id" character varying(50) NOT NULL,
      "nombre" character varying(200) NOT NULL,
      "moneda" character varying(10) NOT NULL,
      "token" text NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_cuentas_anuncios" PRIMARY KEY ("tenant"))`);
    await q.query(
      `CREATE INDEX "IDX_leads_anuncio" ON "leads" ((referral->>'sourceId')) WHERE referral IS NOT NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "IDX_leads_anuncio"`);
    await q.query(`DROP TABLE "cuentas_anuncios"`);
  }
}
