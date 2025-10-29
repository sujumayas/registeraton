require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

// Initialize SQLite database
const db = new sqlite3.Database('participants.db');

// Database initialization with migrations
db.serialize(() => {
  // Create events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date DATE,
      description TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if participants table exists and needs migration
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='participants'", [], (err, table) => {
    if (table) {
      // Table exists, check if it needs migration
      db.all("PRAGMA table_info(participants)", [], (err, columns) => {
        const hasEventId = columns && columns.some(col => col.name === 'event_id');

        if (!hasEventId) {
          // Table exists but needs migration
          console.log('Migrating participants table...');

          // Create new table with event_id
          db.run(`
            CREATE TABLE participants_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id INTEGER,
              full_name TEXT NOT NULL,
              email TEXT NOT NULL,
              area TEXT NOT NULL,
              registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id)
            )
          `);

          // Check if old table has data
          db.get("SELECT COUNT(*) as count FROM participants", [], (err, result) => {
            if (result && result.count > 0) {
              // Create default event for existing data
              db.run(
                "INSERT INTO events (name, event_date, description) VALUES (?, ?, ?)",
                ['Initial Event', new Date().toISOString().split('T')[0], 'Auto-created for existing participants'],
                function(err) {
                  if (err) {
                    console.error('Error creating default event:', err);
                    return;
                  }

                  const defaultEventId = this.lastID;
                  console.log(`Created default event with ID ${defaultEventId}`);

                  // Copy data with default event_id
                  db.run(
                    `INSERT INTO participants_new (id, event_id, full_name, email, area, registered_at)
                     SELECT id, ${defaultEventId}, full_name, email, area, registered_at FROM participants`,
                    (err) => {
                      if (err) {
                        console.error('Error migrating participants:', err);
                        return;
                      }

                      // Drop old table and rename new one
                      db.run("DROP TABLE participants", (err) => {
                        if (err) {
                          console.error('Error dropping old participants table:', err);
                          return;
                        }
                        db.run("ALTER TABLE participants_new RENAME TO participants", (err) => {
                          if (err) {
                            console.error('Error renaming participants_new:', err);
                            return;
                          }
                          console.log('Participants table migration complete');
                        });
                      });
                    }
                  );
                }
              );
            } else {
              // No data, just rename table
              db.run("DROP TABLE participants", (err) => {
                if (err) {
                  console.error('Error dropping old participants table:', err);
                  return;
                }
                db.run("ALTER TABLE participants_new RENAME TO participants", (err) => {
                  if (err) {
                    console.error('Error renaming participants_new:', err);
                    return;
                  }
                  console.log('Participants table created with event_id');
                });
              });
            }
          });
        }
      });
    } else {
      // Table doesn't exist, create it
      db.run(`
        CREATE TABLE participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL,
          area TEXT NOT NULL,
          registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating participants table:', err);
        }
      });
    }
  });

  // Check if pre_registered_participants table exists and needs migration
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='pre_registered_participants'", [], (err, table) => {
    if (table) {
      // Table exists, check if it needs migration
      db.all("PRAGMA table_info(pre_registered_participants)", [], (err, columns) => {
        const hasEventId = columns && columns.some(col => col.name === 'event_id');

        if (!hasEventId) {
          console.log('Migrating pre_registered_participants table...');

          // Create new table with event_id
          db.run(`
            CREATE TABLE pre_registered_participants_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id INTEGER,
              identifier_type TEXT NOT NULL,
              identifier_value TEXT NOT NULL,
              full_name TEXT,
              email TEXT,
              dni TEXT,
              area TEXT,
              raw_data TEXT,
              is_registered INTEGER DEFAULT 0,
              registered_participant_id INTEGER,
              uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id),
              FOREIGN KEY (registered_participant_id) REFERENCES participants(id)
            )
          `);

          // Check if old table has data
          db.get("SELECT COUNT(*) as count FROM pre_registered_participants", [], (err, result) => {
            if (result && result.count > 0) {
              // Get the default event ID
              db.get("SELECT id FROM events WHERE name = 'Initial Event'", [], (err, event) => {
                const defaultEventId = event ? event.id : null;

                if (defaultEventId) {
                  // Copy data with default event_id
                  db.run(
                    `INSERT INTO pre_registered_participants_new
                     (id, event_id, identifier_type, identifier_value, full_name, email, dni, area, raw_data, is_registered, registered_participant_id, uploaded_at)
                     SELECT id, ${defaultEventId}, identifier_type, identifier_value, full_name, email, dni, area, raw_data, is_registered, registered_participant_id, uploaded_at
                     FROM pre_registered_participants`,
                    (err) => {
                      if (err) {
                        console.error('Error migrating pre_registered_participants:', err);
                        return;
                      }

                      // Drop old table and rename new one
                      db.run("DROP TABLE pre_registered_participants", (err) => {
                        if (err) {
                          console.error('Error dropping old pre_registered_participants table:', err);
                          return;
                        }
                        db.run("ALTER TABLE pre_registered_participants_new RENAME TO pre_registered_participants", (err) => {
                          if (err) {
                            console.error('Error renaming pre_registered_participants_new:', err);
                            return;
                          }
                          console.log('Pre-registered participants table migration complete');
                        });
                      });
                    }
                  );
                } else {
                  // No default event, just rename table
                  db.run("DROP TABLE pre_registered_participants", (err) => {
                    if (err) {
                      console.error('Error dropping old pre_registered_participants table:', err);
                      return;
                    }
                    db.run("ALTER TABLE pre_registered_participants_new RENAME TO pre_registered_participants");
                  });
                }
              });
            } else {
              // No data, just rename table
              db.run("DROP TABLE pre_registered_participants", (err) => {
                if (err) {
                  console.error('Error dropping old pre_registered_participants table:', err);
                  return;
                }
                db.run("ALTER TABLE pre_registered_participants_new RENAME TO pre_registered_participants", (err) => {
                  if (err) {
                    console.error('Error renaming pre_registered_participants_new:', err);
                    return;
                  }
                  console.log('Pre-registered participants table created with event_id');
                });
              });
            }
          });
        }
      });
    } else {
      // Table doesn't exist, create it
      db.run(`
        CREATE TABLE pre_registered_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER,
          identifier_type TEXT NOT NULL,
          identifier_value TEXT NOT NULL,
          full_name TEXT,
          email TEXT,
          dni TEXT,
          area TEXT,
          raw_data TEXT,
          is_registered INTEGER DEFAULT 0,
          registered_participant_id INTEGER,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id),
          FOREIGN KEY (registered_participant_id) REFERENCES participants(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating pre_registered_participants table:', err);
        }
      });
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store SSE clients for real-time updates
let sseClients = [];

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add client to the list
  sseClients.push(res);

  // Remove client when connection closes
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
});

// Broadcast to all SSE clients
function broadcast(data) {
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// ====== CONFIGURATION ENDPOINT ======

// Serve Supabase configuration to frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
});

// ====== EVENT MANAGEMENT ENDPOINTS ======

// Get all active events
app.get('/api/events', (req, res) => {
  db.all(
    'SELECT * FROM events WHERE is_deleted = 0 ORDER BY event_date DESC, created_at DESC',
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ error: 'Failed to fetch events' });
      }
      res.json(rows);
    }
  );
});

// Create new event
app.post('/api/events', (req, res) => {
  const { name, event_date, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  db.run(
    'INSERT INTO events (name, event_date, description) VALUES (?, ?, ?)',
    [name.trim(), event_date || null, description || null],
    function(err) {
      if (err) {
        console.error('Error creating event:', err);
        return res.status(500).json({ error: 'Failed to create event' });
      }

      const insertedId = this.lastID;

      db.get('SELECT * FROM events WHERE id = ?', [insertedId], (err, row) => {
        if (err) {
          console.error('Error fetching new event:', err);
          return res.status(500).json({ error: 'Failed to fetch new event' });
        }

        broadcast({ type: 'event_created', event: row });
        res.status(201).json(row);
      });
    }
  );
});

// Get single event
app.get('/api/events/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM events WHERE id = ? AND is_deleted = 0', [id], (err, row) => {
    if (err) {
      console.error('Error fetching event:', err);
      return res.status(500).json({ error: 'Failed to fetch event' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(row);
  });
});

// Update event
app.put('/api/events/:id', (req, res) => {
  const { id } = req.params;
  const { name, event_date, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  db.run(
    'UPDATE events SET name = ?, event_date = ?, description = ? WHERE id = ? AND is_deleted = 0',
    [name.trim(), event_date || null, description || null, id],
    function(err) {
      if (err) {
        console.error('Error updating event:', err);
        return res.status(500).json({ error: 'Failed to update event' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      db.get('SELECT * FROM events WHERE id = ?', [id], (err, row) => {
        if (err) {
          console.error('Error fetching updated event:', err);
          return res.status(500).json({ error: 'Failed to fetch updated event' });
        }

        broadcast({ type: 'event_updated', event: row });
        res.json(row);
      });
    }
  );
});

// Soft delete event
app.delete('/api/events/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE events SET is_deleted = 1 WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        console.error('Error deleting event:', err);
        return res.status(500).json({ error: 'Failed to delete event' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Event not found' });
      }

      broadcast({ type: 'event_deleted', id: parseInt(id) });
      res.json({ message: 'Event deleted successfully' });
    }
  );
});

// Get event statistics
app.get('/api/events/:id/stats', (req, res) => {
  const { id } = req.params;

  db.get('SELECT COUNT(*) as count FROM participants WHERE event_id = ?', [id], (err, total) => {
    if (err) {
      console.error('Error fetching event stats:', err);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }

    db.all(
      'SELECT area, COUNT(*) as count FROM participants WHERE event_id = ? GROUP BY area',
      [id],
      (err, byArea) => {
        if (err) {
          console.error('Error fetching area stats:', err);
          return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        // Get pre-registration stats
        db.get(
          'SELECT COUNT(*) as total FROM pre_registered_participants WHERE event_id = ?',
          [id],
          (err, preTotal) => {
            if (err) {
              console.error('Error fetching pre-reg stats:', err);
              return res.status(500).json({ error: 'Failed to fetch statistics' });
            }

            db.get(
              'SELECT COUNT(*) as registered FROM pre_registered_participants WHERE event_id = ? AND is_registered = 1',
              [id],
              (err, preRegistered) => {
                if (err) {
                  console.error('Error fetching registered count:', err);
                  return res.status(500).json({ error: 'Failed to fetch statistics' });
                }

                res.json({
                  total: total.count,
                  byArea: byArea,
                  preRegistered: {
                    total: preTotal.total,
                    registered: preRegistered.registered,
                    pending: preTotal.total - preRegistered.registered
                  }
                });
              }
            );
          }
        );
      }
    );
  });
});

// ====== PARTICIPANT ENDPOINTS (EVENT-SCOPED) ======

// Get all participants for an event
app.get('/api/events/:eventId/participants', (req, res) => {
  const { eventId } = req.params;

  db.all(
    'SELECT * FROM participants WHERE event_id = ? ORDER BY registered_at DESC',
    [eventId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching participants:', err);
        return res.status(500).json({ error: 'Failed to fetch participants' });
      }
      res.json(rows);
    }
  );
});

// Register new participant for an event
app.post('/api/events/:eventId/participants', (req, res) => {
  const { eventId } = req.params;
  const { full_name, email, area } = req.body;

  // Validation
  if (!full_name || !email || !area) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  db.run(
    'INSERT INTO participants (event_id, full_name, email, area) VALUES (?, ?, ?, ?)',
    [eventId, full_name.trim(), email.trim(), area.trim()],
    function(err) {
      if (err) {
        console.error('Error registering participant:', err);
        return res.status(500).json({ error: 'Failed to register participant' });
      }

      const insertedId = this.lastID;

      db.get('SELECT * FROM participants WHERE id = ?', [insertedId], (err, row) => {
        if (err) {
          console.error('Error fetching new participant:', err);
          return res.status(500).json({ error: 'Failed to fetch new participant' });
        }

        // Broadcast to all connected clients
        broadcast({ type: 'new_participant', participant: row, eventId: parseInt(eventId) });

        res.status(201).json(row);
      });
    }
  );
});

// Delete participant
app.delete('/api/events/:eventId/participants/:id', (req, res) => {
  const { eventId, id } = req.params;

  db.run(
    'DELETE FROM participants WHERE id = ? AND event_id = ?',
    [id, eventId],
    function(err) {
      if (err) {
        console.error('Error deleting participant:', err);
        return res.status(500).json({ error: 'Failed to delete participant' });
      }

      if (this.changes > 0) {
        broadcast({ type: 'participant_deleted', id: parseInt(id), eventId: parseInt(eventId) });
        res.json({ message: 'Participant deleted successfully' });
      } else {
        res.status(404).json({ error: 'Participant not found' });
      }
    }
  );
});

// ====== PRE-REGISTRATION ENDPOINTS ======

// Helper function to process Excel with AI
async function processExcelWithAI(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }

    // Get column names
    const columns = Object.keys(jsonData[0]);

    // Take first 5 rows as sample
    const sampleData = jsonData.slice(0, 5);

    // Ask AI to identify columns and best identifier
    const prompt = `You are analyzing an Excel file for event participant pre-registration.

Here are the columns: ${columns.join(', ')}

Here are the first 5 rows of sample data:
${JSON.stringify(sampleData, null, 2)}

Please analyze this data and respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{
  "identifier_type": "dni" | "email" | "name",
  "identifier_column": "exact_column_name",
  "mappings": {
    "full_name": "exact_column_name_or_null",
    "email": "exact_column_name_or_null",
    "dni": "exact_column_name_or_null",
    "area": "exact_column_name_or_null"
  }
}

Priority for identifier: DNI (cedula, documento, identification) > email > name
Use the exact column names from the data.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const aiResponse = message.content[0].text.trim();
    const analysis = JSON.parse(aiResponse);

    return {
      analysis,
      data: jsonData
    };
  } catch (error) {
    console.error('Error processing Excel with AI:', error);
    throw error;
  }
}

// Upload and process Excel file for an event
app.post('/api/events/:eventId/upload-preregister', upload.single('file'), async (req, res) => {
  const { eventId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const { analysis, data } = await processExcelWithAI(req.file.path);

    // Clear existing pre-registered participants for this event
    db.run('DELETE FROM pre_registered_participants WHERE event_id = ?', [eventId], (err) => {
      if (err) {
        console.error('Error clearing pre-registered participants:', err);
        return res.status(500).json({ error: 'Failed to clear existing data' });
      }

      // Insert all participants
      const stmt = db.prepare(`
        INSERT INTO pre_registered_participants
        (event_id, identifier_type, identifier_value, full_name, email, dni, area, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      data.forEach(row => {
        const identifierValue = row[analysis.identifier_column];
        if (!identifierValue) return; // Skip rows without identifier

        const fullName = analysis.mappings.full_name ? row[analysis.mappings.full_name] : null;
        const email = analysis.mappings.email ? row[analysis.mappings.email] : null;
        const dni = analysis.mappings.dni ? row[analysis.mappings.dni] : null;
        const area = analysis.mappings.area ? row[analysis.mappings.area] : null;

        stmt.run(
          eventId,
          analysis.identifier_type,
          String(identifierValue),
          fullName,
          email,
          dni,
          area,
          JSON.stringify(row)
        );
        insertedCount++;
      });

      stmt.finalize((err) => {
        if (err) {
          console.error('Error inserting pre-registered participants:', err);
          return res.status(500).json({ error: 'Failed to insert participants' });
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        // Broadcast update
        broadcast({ type: 'preregister_uploaded', count: insertedCount, eventId: parseInt(eventId) });

        res.json({
          message: 'File processed successfully',
          count: insertedCount,
          analysis: {
            identifier_type: analysis.identifier_type,
            identifier_column: analysis.identifier_column,
            columns_mapped: analysis.mappings
          }
        });
      });
    });
  } catch (error) {
    console.error('Error processing file:', error);
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

// Get all pre-registered participants for an event
app.get('/api/events/:eventId/preregistered', (req, res) => {
  const { eventId } = req.params;

  db.all(
    'SELECT * FROM pre_registered_participants WHERE event_id = ? ORDER BY is_registered ASC, full_name ASC',
    [eventId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching pre-registered participants:', err);
        return res.status(500).json({ error: 'Failed to fetch participants' });
      }
      res.json(rows);
    }
  );
});

// Search pre-registered participants for an event
app.get('/api/events/:eventId/preregistered/search', (req, res) => {
  const { eventId } = req.params;
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const searchPattern = `%${query}%`;

  db.all(
    `SELECT * FROM pre_registered_participants
     WHERE event_id = ?
     AND (full_name LIKE ? OR email LIKE ? OR dni LIKE ? OR identifier_value LIKE ?)
     AND is_registered = 0
     ORDER BY full_name ASC
     LIMIT 50`,
    [eventId, searchPattern, searchPattern, searchPattern, searchPattern],
    (err, rows) => {
      if (err) {
        console.error('Error searching pre-registered participants:', err);
        return res.status(500).json({ error: 'Failed to search participants' });
      }
      res.json(rows);
    }
  );
});

// Register a pre-registered participant
app.post('/api/events/:eventId/preregistered/:id/register', (req, res) => {
  const { eventId, id: preRegId } = req.params;
  const { area } = req.body; // Allow overriding area at registration time

  // First, get the pre-registered participant
  db.get(
    'SELECT * FROM pre_registered_participants WHERE id = ? AND event_id = ? AND is_registered = 0',
    [preRegId, eventId],
    (err, preReg) => {
      if (err) {
        console.error('Error fetching pre-registered participant:', err);
        return res.status(500).json({ error: 'Failed to fetch participant' });
      }

      if (!preReg) {
        return res.status(404).json({ error: 'Participant not found or already registered' });
      }

      // Register the participant
      const finalArea = area || preReg.area || 'Not specified';
      const finalEmail = preReg.email || `${preReg.identifier_value}@temp.com`;

      db.run(
        'INSERT INTO participants (event_id, full_name, email, area) VALUES (?, ?, ?, ?)',
        [eventId, preReg.full_name || preReg.identifier_value, finalEmail, finalArea],
        function(err) {
          if (err) {
            console.error('Error registering participant:', err);
            return res.status(500).json({ error: 'Failed to register participant' });
          }

          const insertedId = this.lastID;

          // Mark as registered
          db.run(
            'UPDATE pre_registered_participants SET is_registered = 1, registered_participant_id = ? WHERE id = ?',
            [insertedId, preRegId],
            (err) => {
              if (err) {
                console.error('Error updating pre-registered status:', err);
                return res.status(500).json({ error: 'Failed to update status' });
              }

              // Get the newly registered participant
              db.get('SELECT * FROM participants WHERE id = ?', [insertedId], (err, participant) => {
                if (err) {
                  console.error('Error fetching new participant:', err);
                  return res.status(500).json({ error: 'Failed to fetch new participant' });
                }

                // Broadcast to all connected clients
                broadcast({ type: 'new_participant', participant, eventId: parseInt(eventId) });
                broadcast({ type: 'preregistered_updated', preRegId, isRegistered: true, eventId: parseInt(eventId) });

                res.status(201).json(participant);
              });
            }
          );
        }
      );
    }
  );
});

// Clear all pre-registered participants for an event
app.delete('/api/events/:eventId/preregistered', (req, res) => {
  const { eventId } = req.params;

  db.run(
    'DELETE FROM pre_registered_participants WHERE event_id = ?',
    [eventId],
    function(err) {
      if (err) {
        console.error('Error clearing pre-registered participants:', err);
        return res.status(500).json({ error: 'Failed to clear participants' });
      }

      broadcast({ type: 'preregister_cleared', eventId: parseInt(eventId) });
      res.json({ message: 'All pre-registered participants cleared', count: this.changes });
    }
  );
});

app.listen(PORT, () => {
  console.log(`\n🎉 Event Registration Server Running!`);
  console.log(`📊 Access the registration app at: http://localhost:${PORT}`);
  console.log(`💾 Database: participants.db\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
