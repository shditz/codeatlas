import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';

const dbPath = 'C:/Users/DELL/Downloads/mangareader2.2.2/.atlas/atlas.db';

if (existsSync(dbPath)) {
  console.log('Found db:', dbPath);
  const db = new DatabaseSync(dbPath);
  console.log('Columns in files table:');
  const columns = db.prepare('PRAGMA table_info(files)').all();
  console.log(columns.map(c => c.name));
  
  console.log('\nFirst 5 files (name, language):');
  console.log(db.prepare('SELECT relative_path, language FROM files LIMIT 5').all());
  db.close();
} else {
  console.log('Could not find atlas.db');
}
