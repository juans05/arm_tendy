import { ValidateIf } from 'class-validator';

// Como @IsOptional, pero solo para campos ausentes: un null explícito se valida (y falla) en vez de llegar a la base.
export const Opcional = () => ValidateIf((_, v) => v !== undefined);
