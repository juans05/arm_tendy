import { MigrationInterface, QueryRunner } from "typeorm";

export class LineasProducto1793897259723 implements MigrationInterface {
    name = 'LineasProducto1793897259723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lineas_producto" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant" character varying(200) NOT NULL, "nombre" character varying(100) NOT NULL, "criterios" text NOT NULL DEFAULT '', "duracion_demo_min" integer NOT NULL DEFAULT '30', "activa" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_0461d457ba5bc6f0bad108c39f9" UNIQUE ("tenant", "nombre"), CONSTRAINT "PK_e04834842902d7db69ac0b82f41" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "linea_producto_comerciales" ("linea_id" uuid NOT NULL, "miembro_id" uuid NOT NULL, CONSTRAINT "PK_2e7fdb939a8d6020096456f1f7c" PRIMARY KEY ("linea_id", "miembro_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2cc38771da863aeb1a9608e60f" ON "linea_producto_comerciales" ("linea_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_61fb21862cb385e104051a19b8" ON "linea_producto_comerciales" ("miembro_id") `);
        await queryRunner.query(`ALTER TABLE "linea_producto_comerciales" ADD CONSTRAINT "FK_2cc38771da863aeb1a9608e60f1" FOREIGN KEY ("linea_id") REFERENCES "lineas_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "linea_producto_comerciales" ADD CONSTRAINT "FK_61fb21862cb385e104051a19b85" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "linea_producto_comerciales" DROP CONSTRAINT "FK_61fb21862cb385e104051a19b85"`);
        await queryRunner.query(`ALTER TABLE "linea_producto_comerciales" DROP CONSTRAINT "FK_2cc38771da863aeb1a9608e60f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_61fb21862cb385e104051a19b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2cc38771da863aeb1a9608e60f"`);
        await queryRunner.query(`DROP TABLE "linea_producto_comerciales"`);
        await queryRunner.query(`DROP TABLE "lineas_producto"`);
    }

}
