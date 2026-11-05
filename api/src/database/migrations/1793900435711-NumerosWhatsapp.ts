import { MigrationInterface, QueryRunner } from 'typeorm';

export class NumerosWhatsapp1793900435711 implements MigrationInterface {
  name = 'NumerosWhatsapp1793900435711';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "numeros_whatsapp" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "phone_number_id" character varying(50) NOT NULL, "waba_id" character varying(50) NOT NULL, "telefono" character varying(20) NOT NULL, "nombre_verificado" character varying(200), "token" text NOT NULL, "coexistencia" boolean NOT NULL DEFAULT false, "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_36d52ce84300c52a41df536b00f" UNIQUE ("phone_number_id"), CONSTRAINT "PK_6f22f10d81b1b528c118cc1438e" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "numeros_whatsapp"`);
  }
}
