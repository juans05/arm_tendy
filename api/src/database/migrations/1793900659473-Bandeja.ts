import { MigrationInterface, QueryRunner } from "typeorm";

export class Bandeja1793900659473 implements MigrationInterface {
    name = 'Bandeja1793900659473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contactos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "telefono" character varying(20) NOT NULL, "nombre" character varying(200) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8eecd91d40dae03b0b4c21bf7f5" UNIQUE ("tenant", "telefono"), CONSTRAINT "PK_d8a88d3690915aba8dc617a7ffd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "conversaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "numero_id" uuid NOT NULL, "contacto_id" uuid NOT NULL, "modo" character varying(10) NOT NULL DEFAULT 'ia', "ultimo_mensaje_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ultimo_entrante_en" TIMESTAMP WITH TIME ZONE, "no_leidos" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_77a8ae5d0648b8193ed352d4373" UNIQUE ("numero_id", "contacto_id"), CONSTRAINT "PK_f66299f2c12dd08b4ae19feefc5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "mensajes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "conversacion_id" uuid NOT NULL, "direccion" character varying(10) NOT NULL, "origen" character varying(15) NOT NULL, "tipo" character varying(20) NOT NULL, "texto" text, "media_id" character varying(100), "mime_type" character varying(100), "wa_message_id" character varying(100), "referral" jsonb, "autor_miembro_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_66112062f8766f9d1ed64c182fc" UNIQUE ("wa_message_id"), CONSTRAINT "PK_20c919d08249bb93d84ce01beb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0c3f1e704cecabdc5afe0ce508" ON "mensajes" ("conversacion_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "conversaciones" ADD CONSTRAINT "FK_1ff42dd885dafc3e1462d385f18" FOREIGN KEY ("numero_id") REFERENCES "numeros_whatsapp"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversaciones" ADD CONSTRAINT "FK_1b8a657f4e196a1c7ca024a1898" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mensajes" ADD CONSTRAINT "FK_7f8b407efa1135b971fdd05c079" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mensajes" DROP CONSTRAINT "FK_7f8b407efa1135b971fdd05c079"`);
        await queryRunner.query(`ALTER TABLE "conversaciones" DROP CONSTRAINT "FK_1b8a657f4e196a1c7ca024a1898"`);
        await queryRunner.query(`ALTER TABLE "conversaciones" DROP CONSTRAINT "FK_1ff42dd885dafc3e1462d385f18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c3f1e704cecabdc5afe0ce508"`);
        await queryRunner.query(`DROP TABLE "mensajes"`);
        await queryRunner.query(`DROP TABLE "conversaciones"`);
        await queryRunner.query(`DROP TABLE "contactos"`);
    }

}
