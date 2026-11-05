import { MigrationInterface, QueryRunner } from 'typeorm';

export class Miembros1793897103104 implements MigrationInterface {
  name = 'Miembros1793897103104';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "miembros" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "user_id" character varying(100) NOT NULL, "username" character varying(100) NOT NULL, "nombre" character varying(200) NOT NULL, "rol" character varying(20) NOT NULL, "estado" character varying(20) NOT NULL, "celular_alertas" character varying(20), "recibe_demos" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ed7c3887d8f7611e5dd7979302c" UNIQUE ("tenant", "user_id"), CONSTRAINT "PK_2a96702e5f38690e048e3f11c68" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "miembros"`);
  }
}
