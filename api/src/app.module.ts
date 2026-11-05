import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { SuiteAuthGuard } from './auth/suite-auth.guard';
import { DatabaseConfig } from './config/database.config';
import { HealthController } from './health/health.controller';
import { AgenteModule } from './agente/agente.module';
import { AlertasModule } from './alertas/alertas.module';
import { CalendarioModule } from './calendario/calendario.module';
import { LeadsModule } from './leads/leads.module';
import { SeguimientoModule } from './seguimiento/seguimiento.module';
import { BandejaModule } from './bandeja/bandeja.module';
import { CanalesModule } from './canales/canales.module';
import { ConocimientoModule } from './conocimiento/conocimiento.module';
import { IaModule } from './ia/ia.module';
import { LineasModule } from './lineas/lineas.module';
import { MiembroActivoGuard } from './miembros/miembro-activo.guard';
import { MiembrosModule } from './miembros/miembros.module';
import { RolesGuard } from './miembros/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    AuthModule,
    MiembrosModule,
    LineasModule,
    CanalesModule,
    BandejaModule,
    IaModule,
    ConocimientoModule,
    AgenteModule,
    AlertasModule,
    LeadsModule,
    CalendarioModule,
    SeguimientoModule,
  ],
  controllers: [HealthController],
  // El orden importa: primero el token, luego el miembro, luego el rol.
  providers: [
    { provide: APP_GUARD, useClass: SuiteAuthGuard },
    { provide: APP_GUARD, useClass: MiembroActivoGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
