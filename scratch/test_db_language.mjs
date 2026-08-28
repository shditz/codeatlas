import { AtlasDatabase } from '../packages/storage/dist/index.js';
import { resolve } from 'path';

const db = new AtlasDatabase(':memory:');
db.connect();

const fileRepo = db.repositories.files;

fileRepo.upsert(1, {
  path: '/test/admin.css',
  relativePath: 'admin.css',
  extension: '.css',
  language: 'css',
  size: 100,
  hash: 'abc',
  module: '.',
  isTest: false,
  isGenerated: false,
  symbolCount: 0,
  importCount: 0,
  exportCount: 0,
  lastModified: Date.now()
});

const files = fileRepo.getAll(1);
console.log('Files from DB:', files);
db.disconnect();
