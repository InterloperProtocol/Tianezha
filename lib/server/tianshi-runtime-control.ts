import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

import { nowIso } from "@/lib/utils";

export type TianshiRuntimeControl = {
  lastChangedAt: string | null;
  lastChangedBy: string | null;
  lastFinalizedBlockHeight: number;
  note: string | null;
  simulationEnabled: boolean;
};

declare global {
  var __tianshiRuntimeControl: TianshiRuntimeControl | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "tianshi-runtime-control.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createDefaultControl(): TianshiRuntimeControl {
  return {
    lastChangedAt: null,
    lastChangedBy: null,
    lastFinalizedBlockHeight: 0,
    note: "Paused by default until enabled from the hidden admin panel.",
    simulationEnabled: false,
  };
}

function persistControl(control: TianshiRuntimeControl) {
  ensureDataDir();
  writeFileSync(STORE_PATH, JSON.stringify(control, null, 2));
}

function readControl() {
  ensureDataDir();
  if (!existsSync(STORE_PATH)) {
    const control = createDefaultControl();
    persistControl(control);
    return control;
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as Partial<TianshiRuntimeControl>;
    return {
      ...createDefaultControl(),
      ...parsed,
    } satisfies TianshiRuntimeControl;
  } catch {
    const control = createDefaultControl();
    persistControl(control);
    return control;
  }
}

export function getTianshiRuntimeControl() {
  if (!global.__tianshiRuntimeControl) {
    global.__tianshiRuntimeControl = readControl();
  }

  return global.__tianshiRuntimeControl;
}

export function setTianshiRuntimeControl(
  next: Partial<TianshiRuntimeControl> & Pick<TianshiRuntimeControl, "simulationEnabled">,
) {
  const current = getTianshiRuntimeControl();
  const control = {
    ...current,
    ...next,
    lastChangedAt: nowIso(),
  } satisfies TianshiRuntimeControl;

  global.__tianshiRuntimeControl = control;
  persistControl(control);
  return control;
}

export function resetTianshiRuntimeControl() {
  const control = createDefaultControl();
  global.__tianshiRuntimeControl = control;
  persistControl(control);
  return control;
}
