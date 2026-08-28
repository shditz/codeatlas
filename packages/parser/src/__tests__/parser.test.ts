import { describe, it, expect } from 'vitest';
import { parseFile } from '../index.js';

describe('Tree-sitter Parser (TS/JS/Py/Go/Rust)', () => {
  it('extracts classes, methods, and functions from TypeScript', async () => {
    const tsCode = `
      import { Injectable } from '@nestjs/common';
      import type { User } from './user.entity';

      export interface AuthResponse {
        token: string;
        expiresIn: number;
      }

      export type AuthToken = string;

      export class AuthService {
        private secret: string;

        async login(email: string, pass: string): Promise<AuthResponse> {
          return { token: 'jwt', expiresIn: 3600 };
        }
      }

      export function validateToken(token: string): boolean {
        return token.length > 0;
      }

      const helper = () => true;
    `;

    const result = await parseFile('src/auth.service.ts', tsCode, 'typescript');

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]?.importPath).toBe('@nestjs/common');
    expect(result.imports[1]?.isType).toBe(true);

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('AuthResponse');
    expect(names).toContain('AuthToken');
    expect(names).toContain('AuthService');
    expect(names).toContain('login');
    expect(names).toContain('validateToken');

    const authService = result.symbols.find((s) => s.name === 'AuthService');
    expect(authService?.kind).toBe('class');
    expect(authService?.exported).toBe(true);

    const loginMethod = result.symbols.find((s) => s.name === 'login');
    expect(loginMethod?.kind).toBe('method');
    expect(loginMethod?.parentSymbol).toBe('AuthService');
  });

  it('handles JavaScript code with ES exports', async () => {
    const jsCode = `
      import express from 'express';

      export class Router {
        handle(req, res) {}
      }

      export const PORT = 3000;
    `;

    const result = await parseFile('src/server.js', jsCode, 'javascript');
    expect(result.errors).toHaveLength(0);
    expect(result.symbols.map((s) => s.name)).toContain('Router');
    expect(result.symbols.map((s) => s.name)).toContain('PORT');
  });

  it('extracts classes, methods, and functions from Python', async () => {
    const pyCode = `
import os
from typing import List, Optional

class UserManager:
    def __init__(self, db_url: str):
        self.db_url = db_url

    async def get_user(self, user_id: int) -> Optional[dict]:
        return {"id": user_id}

def calculate_stats(users: List[dict]) -> dict:
    return {"total": len(users)}
`;

    const result = await parseFile('app/services.py', pyCode, 'python');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]?.importPath).toBe('os');
    expect(result.imports[1]?.importPath).toBe('typing');

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('UserManager');
    expect(names).toContain('__init__');
    expect(names).toContain('get_user');
    expect(names).toContain('calculate_stats');

    const userManager = result.symbols.find((s) => s.name === 'UserManager');
    expect(userManager?.kind).toBe('class');

    const getUser = result.symbols.find((s) => s.name === 'get_user');
    expect(getUser?.kind).toBe('method');
    expect(getUser?.parentSymbol).toBe('UserManager');
  });

  it('extracts functions, structs, and methods from Go', async () => {
    const goCode = `
package server

import (
    "fmt"
    "net/http"
)

type Config struct {
    Port int
}

type Handler interface {
    ServeHTTP(w http.ResponseWriter, r *http.Request)
}

func NewConfig(port int) *Config {
    return &Config{Port: port}
}

func (c *Config) GetPort() int {
    return c.Port
}
`;

    const result = await parseFile('pkg/server/server.go', goCode, 'go');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('Config');
    expect(names).toContain('Handler');
    expect(names).toContain('NewConfig');
    expect(names).toContain('GetPort');

    const config = result.symbols.find((s) => s.name === 'Config');
    expect(config?.kind).toBe('struct');
    expect(config?.exported).toBe(true);

    const handler = result.symbols.find((s) => s.name === 'Handler');
    expect(handler?.kind).toBe('interface');

    const getPort = result.symbols.find((s) => s.name === 'GetPort');
    expect(getPort?.kind).toBe('method');
  });

  it('extracts structs, traits, enums, and functions from Rust', async () => {
    const rustCode = `
use std::collections::HashMap;

pub struct Cache {
    entries: HashMap<String, String>,
}

pub enum CacheStatus {
    Hit,
    Miss,
}

pub trait Storage {
    fn save(&self) -> bool;
}

impl Cache {
    pub fn new() -> Self {
        Cache { entries: HashMap::new() }
    }
}

pub fn initialize_cache() -> Cache {
    Cache::new()
}
`;

    const result = await parseFile('src/cache.rs', rustCode, 'rust');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);

    const names = result.symbols.map((s) => s.name);
    expect(names).toContain('Cache');
    expect(names).toContain('CacheStatus');
    expect(names).toContain('Storage');
    expect(names).toContain('new');
    expect(names).toContain('initialize_cache');

    const cache = result.symbols.find((s) => s.name === 'Cache');
    expect(cache?.kind).toBe('struct');
    expect(cache?.exported).toBe(true);

    const status = result.symbols.find((s) => s.name === 'CacheStatus');
    expect(status?.kind).toBe('enum');
  });

  it('extracts symbols and imports from C#', async () => {
    const csCode = `
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;

namespace App.Controllers
{
    public class UserController : ControllerBase
    {
        public async Task<IActionResult> GetUser(int id)
        {
            return Ok();
        }
    }
}
`;
    const result = await parseFile('Controllers/UserController.cs', csCode, 'csharp');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.symbols.map((s) => s.name)).toContain('UserController');
    expect(result.symbols.map((s) => s.name)).toContain('GetUser');
  });

  it('extracts symbols and imports from C++', async () => {
    const cppCode = `
#include <vector>
#include "engine/render.h"

class GameEngine {
public:
    void Start() {
    }
};

struct Vector3 {
    float x, y, z;
};
`;
    const result = await parseFile('src/engine.cpp', cppCode, 'cpp');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.symbols.map((s) => s.name)).toContain('GameEngine');
    expect(result.symbols.map((s) => s.name)).toContain('Vector3');
    expect(result.symbols.map((s) => s.name)).toContain('Start');
  });

  it('extracts symbols and imports from Java', async () => {
    const javaCode = `
import java.util.List;
import org.springframework.stereotype.Service;

public class OrderService {
    public Order processOrder(Long id) {
        return null;
    }
}
`;
    const result = await parseFile('OrderService.java', javaCode, 'java');
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(2);
    expect(result.symbols.map((s) => s.name)).toContain('OrderService');
    expect(result.symbols.map((s) => s.name)).toContain('processOrder');
  });

  it('extracts symbols and imports from Ruby, Kotlin, and Swift', async () => {
    const rbCode = `
require 'json'
class ApiClient
  def fetch_data
  end
end
`;
    const rbResult = await parseFile('client.rb', rbCode, 'ruby');
    expect(rbResult.symbols.map((s) => s.name)).toContain('ApiClient');
    expect(rbResult.symbols.map((s) => s.name)).toContain('fetch_data');

    const ktCode = `
import kotlinx.coroutines.flow.Flow
class UserRepository {
    fun fetchUser(): Flow<User> {
    }
}
`;
    const ktResult = await parseFile('UserRepository.kt', ktCode, 'kotlin');
    expect(ktResult.symbols.map((s) => s.name)).toContain('UserRepository');
    expect(ktResult.symbols.map((s) => s.name)).toContain('fetchUser');

    const swiftCode = `
import SwiftUI
public struct ProfileView {
    public func render() {
    }
}
`;
    const swiftResult = await parseFile('ProfileView.swift', swiftCode, 'swift');
    expect(swiftResult.symbols.map((s) => s.name)).toContain('ProfileView');
    expect(swiftResult.symbols.map((s) => s.name)).toContain('render');
  });
});
