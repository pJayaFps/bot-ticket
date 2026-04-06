import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'config.json');

const defaultData = {
  config: {
    ticketPanel: {
      title: 'Central de Tickets',
      description: 'Clique no botão para abrir seu ticket.',
      color: '#2b2d31',
      openChannelId: '',
      categoryId: '',
      staffRoleId: '',
      openerRoleId: ''
    },
    ticket: {
      autoMessage: 'Olá! Descreva seu pedido e aguarde um atendente.',
      logsChannelId: '',
      closedCategoryId: '',
      deleteClosedAfterSeconds: 0
    },
    pix: {
      qrCode: '',
      pixKey: '',
      receiverName: '',
      value: '',
      message: 'Use os dados abaixo para pagar.'
    },
    transcript: {
      type: 'txt',
      channelId: ''
    },
    feedbackChannelId: ''
  },
  tickets: {}
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultData));
}

function normalizeDataShape(data) {
  const merged = cloneDefaultData();
  merged.config = { ...merged.config, ...(data?.config || {}) };
  merged.config.ticketPanel = { ...merged.config.ticketPanel, ...(data?.config?.ticketPanel || {}) };
  merged.config.ticket = { ...merged.config.ticket, ...(data?.config?.ticket || {}) };
  merged.config.pix = { ...merged.config.pix, ...(data?.config?.pix || {}) };
  merged.config.transcript = { ...merged.config.transcript, ...(data?.config?.transcript || {}) };
  merged.tickets = data?.tickets && typeof data.tickets === 'object' ? data.tickets : {};
  return merged;
}

export function readData() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return normalizeDataShape(parsed);
  } catch {
    const backupPath = path.join(
      DATA_DIR,
      `config.corrupted-${Date.now()}.json`
    );
    fs.writeFileSync(backupPath, raw, 'utf8');
    const safe = cloneDefaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(safe, null, 2), 'utf8');
    return safe;
  }
}

export function writeData(nextData) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextData, null, 2), 'utf8');
}

export function updateData(mutator) {
  const data = readData();
  mutator(data);
  writeData(data);
  return data;
}
