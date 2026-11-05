import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SuiteUser } from './suite-user';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SuiteUser => ctx.switchToHttp().getRequest().user);
