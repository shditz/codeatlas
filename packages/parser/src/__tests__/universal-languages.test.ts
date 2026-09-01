import { describe, it, expect } from 'vitest';
import { parseFile } from '../tree-sitter-parser.js';

describe('Universal Polyglot Language Parsing Engine', () => {
  it('parses Dart classes, enums, functions, and imports', async () => {
    const dartCode = `
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

enum AuthStatus { authenticated, unauthenticated }

class UserService {
  Future<void> loginUser(String email) async {
    // login logic
  }
}
`;
    const result = await parseFile('lib/user_service.dart', dartCode, 'dart');

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]?.importPath).toBe('package:flutter/material.dart');

    const classSym = result.symbols.find((s) => s.kind === 'class');
    expect(classSym?.name).toBe('UserService');

    const enumSym = result.symbols.find((s) => s.kind === 'enum');
    expect(enumSym?.name).toBe('AuthStatus');

    const funcSym = result.symbols.find((s) => s.kind === 'function');
    expect(funcSym?.name).toBe('loginUser');
  });

  it('parses Scala objects, traits, classes, and imports', async () => {
    const scalaCode = `
import com.myorg.utils._

trait DataRepository {
  def fetchData(): Seq[String]
}

case class UserProfile(id: String, name: String)
`;
    const result = await parseFile('src/User.scala', scalaCode, 'scala');

    expect(result.imports).toHaveLength(1);
    expect(result.imports[0]?.importPath).toBe('com.myorg.utils._');

    const traitSym = result.symbols.find((s) => s.kind === 'interface');
    expect(traitSym?.name).toBe('DataRepository');

    const classSym = result.symbols.find((s) => s.kind === 'class');
    expect(classSym?.name).toBe('UserProfile');
  });

  it('parses Lua modules, functions, and require calls', async () => {
    const luaCode = `
local http = require("socket.http")
local json = require('cjson')

local function calculateHash(data)
  return data
end

function UserService:getUser(id)
  return nil
end
`;
    const result = await parseFile('lua/service.lua', luaCode, 'lua');

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]?.importPath).toBe('socket.http');

    const funcNames = result.symbols.map((s) => s.name);
    expect(funcNames).toContain('calculateHash');
    expect(funcNames).toContain('getUser');
  });

  it('parses Elixir defmodule and def functions', async () => {
    const elixirCode = `
defmodule MyApp.Accounts.User do
  import Ecto.Query
  alias MyApp.Repo

  def get_user!(id) do
    Repo.get!(User, id)
  end

  defp validate_credentials(email, password) do
    true
  end
end
`;
    const result = await parseFile('lib/accounts/user.ex', elixirCode, 'elixir');

    expect(result.imports.length).toBeGreaterThanOrEqual(2);
    const modSym = result.symbols.find((s) => s.kind === 'class');
    expect(modSym?.name).toBe('MyApp.Accounts.User');

    const funcSym = result.symbols.find((s) => s.name === 'get_user!');
    expect(funcSym).toBeDefined();
    expect(funcSym?.exported).toBe(true);

    const privateFunc = result.symbols.find((s) => s.name === 'validate_credentials');
    expect(privateFunc?.exported).toBe(false);
  });

  it('parses Zig structs and functions', async () => {
    const zigCode = `
const std = @import("std");

pub const Config = struct {
  port: u16,
};

pub fn startServer() void {
  // start
}
`;
    const result = await parseFile('src/main.zig', zigCode, 'zig');

    expect(result.imports).toHaveLength(1);
    expect(result.imports[0]?.importPath).toBe('std');

    const structSym = result.symbols.find((s) => s.kind === 'struct');
    expect(structSym?.name).toBe('Config');

    const funcSym = result.symbols.find((s) => s.kind === 'function');
    expect(funcSym?.name).toBe('startServer');
  });

  it('parses GraphQL types and queries', async () => {
    const gqlCode = `
type User {
  id: ID!
  email: String!
}

query GetCurrentUser {
  me { id }
}
`;
    const result = await parseFile('schema.graphql', gqlCode, 'graphql');

    const typeSym = result.symbols.find((s) => s.name === 'User');
    expect(typeSym).toBeDefined();

    const querySym = result.symbols.find((s) => s.name === 'GetCurrentUser');
    expect(querySym).toBeDefined();
  });

  it('parses SQL table schemas and procedures', async () => {
    const sqlCode = `
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(255)
);

CREATE PROCEDURE FindActiveUsers()
BEGIN
  SELECT * FROM users WHERE active = 1;
END;
`;
    const result = await parseFile('db/schema.sql', sqlCode, 'sql');

    const tableSym = result.symbols.find((s) => s.name === 'users');
    expect(tableSym?.kind).toBe('model');

    const procSym = result.symbols.find((s) => s.name === 'FindActiveUsers');
    expect(procSym?.kind).toBe('function');
  });
});
