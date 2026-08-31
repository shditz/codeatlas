import { describe, it, expect } from 'vitest';
import { parseFile } from '../index.js';

describe('Framework-Specific Adapters', () => {
  describe('React Hooks Adapter', () => {
    it('identifies custom React Hooks as kind "hook"', async () => {
      const code = `
export function useAuth() {
  const [user, setUser] = useState(null);
  return { user };
}

export const useLocalStorage = (key: string) => {
  return [key];
};

export function normalFunction() {
  return 42;
}
`;
      const result = await parseFile('src/hooks/useAuth.ts', code, 'typescript');
      const hook1 = result.symbols.find((s) => s.name === 'useAuth');
      const hook2 = result.symbols.find((s) => s.name === 'useLocalStorage');
      const fn = result.symbols.find((s) => s.name === 'normalFunction');

      expect(hook1?.kind).toBe('hook');
      expect(hook2?.kind).toBe('hook');
      expect(fn?.kind).toBe('function');
    });
  });

  describe('Next.js App Router Adapter', () => {
    it('identifies page and layout components based on App Router file conventions', async () => {
      const pageCode = `
export default function DashboardPage() {
  return <div>Dashboard</div>;
}
`;
      const layoutCode = `
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`;
      const pageResult = await parseFile('app/dashboard/page.tsx', pageCode, 'typescript');
      const layoutResult = await parseFile('app/layout.tsx', layoutCode, 'typescript');

      const pageSymbol = pageResult.symbols.find((s) => s.name === 'DashboardPage');
      const layoutSymbol = layoutResult.symbols.find((s) => s.name === 'RootLayout');

      expect(pageSymbol?.kind).toBe('page');
      expect(layoutSymbol?.kind).toBe('layout');
    });

    it('identifies Next.js App Router HTTP Route Handlers', async () => {
      const routeCode = `
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  return NextResponse.json({ created: true });
}
`;
      const result = await parseFile('src/app/api/users/route.ts', routeCode, 'typescript');
      const getHandler = result.symbols.find((s) => s.name === 'GET');
      const postHandler = result.symbols.find((s) => s.name === 'POST');

      expect(getHandler?.kind).toBe('route_handler');
      expect(postHandler?.kind).toBe('route_handler');
    });
  });

  describe('NestJS Dependency Injection Adapter', () => {
    it('identifies @Controller, @Injectable, and @Module classes', async () => {
      const controllerCode = `
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}
}
`;
      const serviceCode = `
@Injectable()
export class UsersService {
  findAll() { return []; }
}
`;
      const moduleCode = `
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
`;
      const ctrlResult = await parseFile('src/users/users.controller.ts', controllerCode, 'typescript');
      const srvResult = await parseFile('src/users/users.service.ts', serviceCode, 'typescript');
      const modResult = await parseFile('src/users/users.module.ts', moduleCode, 'typescript');

      const ctrlSym = ctrlResult.symbols.find((s) => s.name === 'UsersController');
      const srvSym = srvResult.symbols.find((s) => s.name === 'UsersService');
      const modSym = modResult.symbols.find((s) => s.name === 'UsersModule');

      expect(ctrlSym?.kind).toBe('controller');
      expect(srvSym?.kind).toBe('provider');
      expect(modSym?.kind).toBe('module');
    });
  });

  describe('Prisma Schema Adapter', () => {
    it('parses Prisma schema models, enums, fields, and relation dependencies', async () => {
      const prismaCode = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  ADMIN
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
}
`;
      const result = await parseFile('prisma/schema.prisma', prismaCode, 'prisma');

      const userModel = result.symbols.find((s) => s.name === 'User' && s.kind === 'model');
      const postModel = result.symbols.find((s) => s.name === 'Post' && s.kind === 'model');
      const roleEnum = result.symbols.find((s) => s.name === 'Role' && s.kind === 'enum');

      expect(userModel).toBeDefined();
      expect(userModel?.kind).toBe('model');
      expect(postModel).toBeDefined();
      expect(postModel?.kind).toBe('model');
      expect(roleEnum).toBeDefined();
      expect(roleEnum?.kind).toBe('enum');

      // Check fields
      const userEmail = result.symbols.find((s) => s.name === 'email' && s.parentSymbol === 'User');
      expect(userEmail).toBeDefined();

      // Check relation dependencies extracted (Post references User, User references Post)
      const postDep = result.imports.find((i) => i.importPath === 'Post');
      const userDep = result.imports.find((i) => i.importPath === 'User');
      expect(postDep).toBeDefined();
      expect(userDep).toBeDefined();
    });
  });
});
