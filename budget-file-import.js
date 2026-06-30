(function () {
  const MATERIAL_DENSITY = {
    pla: 1.24,
    petg: 1.27,
    abs: 1.04,
    asa: 1.07,
    tpu: 1.21,
    pc: 1.2,
    nylon: 1.14,
    pa: 1.14,
    hips: 1.04,
    resin: 1.1
  };

  function fileImportNumber(value, fallback = 0) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fileImportSafe(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "");
  }

  function fileImportMaterialKey(value = "") {
    const text = String(value || "").toLowerCase();
    if (text.includes("petg")) return "petg";
    if (text.includes("abs")) return "abs";
    if (text.includes("asa")) return "asa";
    if (text.includes("tpu")) return "tpu";
    if (text.includes("nylon") || text.includes("pa-")) return "pa";
    if (text.includes("resin") || text.includes("resina")) return "resin";
    if (text.includes("pla")) return "pla";
    return "pla";
  }

  function fileImportDetectMaterial(text = "", fileName = "") {
    const source = `${fileName}\n${text}`;
    const matches = [
      /filament_type\s*=\s*([^;\n\r]+)/i,
      /filament_type\s*:\s*([^;\n\r]+)/i,
      /material\s*=\s*([^;\n\r]+)/i,
      /material\s*:\s*([^;\n\r]+)/i,
      /;\s*MATERIAL\s*:\s*([^;\n\r]+)/i,
      /;\s*filament_settings_id\s*=\s*([^;\n\r]+)/i
    ];
    for (const regex of matches) {
      const found = source.match(regex);
      if (found?.[1]) return found[1].trim().split(/[;,]/)[0].trim();
    }
    const key = fileImportMaterialKey(source);
    return key === "pa" ? "Nylon" : key.toUpperCase();
  }

  function fileImportDetectDiameter(text = "") {
    const patterns = [/filament_diameter\s*=\s*([\d.,]+)/i, /filament_diameter\s*:\s*([\d.,]+)/i, /M200\s+D([\d.,]+)/i];
    for (const regex of patterns) {
      const found = text.match(regex);
      if (found?.[1]) return fileImportNumber(found[1], 1.75);
    }
    return 1.75;
  }

  function fileImportLengthToGrams(lengthMm, material, diameter = 1.75) {
    const density = MATERIAL_DENSITY[fileImportMaterialKey(material)] || MATERIAL_DENSITY.pla;
    const radius = diameter / 2;
    const volumeMm3 = Math.PI * radius * radius * lengthMm;
    return (volumeMm3 / 1000) * density;
  }

  function fileImportParseTimeText(value = "") {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return 0;
    if (/^\d+(\.\d+)?$/.test(text)) return Number(text) / 3600;
    let seconds = 0;
    const day = text.match(/(\d+(?:[\.,]\d+)?)\s*d/);
    const hour = text.match(/(\d+(?:[\.,]\d+)?)\s*h/);
    const minute = text.match(/(\d+(?:[\.,]\d+)?)\s*m(?!m)/);
    const second = text.match(/(\d+(?:[\.,]\d+)?)\s*s/);
    if (day) seconds += fileImportNumber(day[1]) * 86400;
    if (hour) seconds += fileImportNumber(hour[1]) * 3600;
    if (minute) seconds += fileImportNumber(minute[1]) * 60;
    if (second) seconds += fileImportNumber(second[1]);
    const colon = text.match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
    if (!seconds && colon) {
      seconds = (Number(colon[1] || 0) * 3600) + (Number(colon[2] || 0) * 60) + Number(colon[3] || 0);
    }
    return seconds / 3600;
  }

  function fileImportFirstNumber(patterns, text) {
    for (const regex of patterns) {
      const found = text.match(regex);
      if (found?.[1]) return fileImportNumber(found[1], 0);
    }
    return 0;
  }

  function fileImportParseGcode(text = "", fileName = "arquivo.gcode") {
    const material = fileImportDetectMaterial(text, fileName);
    const diameter = fileImportDetectDiameter(text);
    let grams = fileImportFirstNumber([
      /filament\s+used\s*\[g\]\s*=\s*([\d.,]+)/i,
      /total\s+filament\s+used\s*\[g\]\s*=\s*([\d.,]+)/i,
      /filament\s+weight\s*[:=]\s*([\d.,]+)\s*g?/i,
      /total\s+filament\s+weight\s*[:=]\s*([\d.,]+)\s*g?/i,
      /;\s*Filament\s+Weight\s*:\s*([\d.,]+)/i,
      /;\s*filament\s+used\s+grams\s*[:=]\s*([\d.,]+)/i
    ], text);

    let lengthMm = fileImportFirstNumber([
      /filament\s+used\s*\[mm\]\s*=\s*([\d.,]+)/i,
      /total\s+filament\s+used\s*\[mm\]\s*=\s*([\d.,]+)/i,
      /filament\s+length\s*[:=]\s*([\d.,]+)\s*mm/i
    ], text);

    if (!lengthMm) {
      const meters = fileImportFirstNumber([/filament\s+used\s*[:=]\s*([\d.,]+)\s*m/i, /filament\s+length\s*[:=]\s*([\d.,]+)\s*m/i], text);
      if (meters) lengthMm = meters * 1000;
    }
    if (!grams && lengthMm) grams = fileImportLengthToGrams(lengthMm, material, diameter);

    let hours = 0;
    const timeSeconds = fileImportFirstNumber([/;\s*TIME\s*:\s*(\d+)/i, /estimated\s+printing\s+time\s*\(normal\s+mode\)\s*=\s*([^\n\r]+)/i], text);
    if (timeSeconds && String(timeSeconds).length <= 8 && /;\s*TIME\s*:/i.test(text)) hours = timeSeconds / 3600;
    if (!hours) {
      const timeMatches = [
        text.match(/estimated\s+printing\s+time[^=:\n\r]*[=:]\s*([^\n\r]+)/i),
        text.match(/print\s+time[^=:\n\r]*[=:]\s*([^\n\r]+)/i),
        text.match(/printing\s+time[^=:\n\r]*[=:]\s*([^\n\r]+)/i),
        text.match(/;\s*TIME_ELAPSED\s*:\s*([\d.,]+)/i)
      ].filter(Boolean);
      for (const match of timeMatches) {
        const parsed = fileImportParseTimeText(match[1]);
        if (parsed) { hours = parsed; break; }
      }
    }

    const project = fileName.replace(/\.(gcode|gco|gc|3mf|zip)$/i, "").replace(/[_-]+/g, " ").trim();
    return {
      kind: "gcode",
      fileName,
      project,
      material,
      diameter,
      grams,
      lengthMm,
      hours,
      confidence: grams && hours ? "alta" : grams || hours ? "parcial" : "baixa",
      notes: [
        grams ? `Peso estimado: ${grams.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} g` : "Peso não encontrado no G-code",
        hours ? `Tempo estimado: ${hours.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h` : "Tempo não encontrado no G-code",
        lengthMm && !grams ? `Comprimento lido: ${lengthMm.toLocaleString("pt-BR")} mm` : "",
        material ? `Material detectado: ${material}` : ""
      ].filter(Boolean)
    };
  }

  async function fileImportInflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (_error) {
      return null;
    }
  }

  async function fileImportReadZipEntries(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const decoder = new TextDecoder();
    const entries = [];
    let offset = 0;
    while (offset + 30 < buffer.byteLength) {
      if (view.getUint32(offset, true) !== 0x04034b50) break;
      const flags = view.getUint16(offset + 6, true);
      const method = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const extraLength = view.getUint16(offset + 28, true);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLength + extraLength;
      const name = decoder.decode(new Uint8Array(buffer, nameStart, nameLength));
      if (!compressedSize || flags & 0x08) break;
      const compressed = new Uint8Array(buffer, dataStart, compressedSize);
      let bytes = null;
      if (method === 0) bytes = compressed;
      if (method === 8) bytes = await fileImportInflateRaw(compressed);
      entries.push({ name, method, bytes });
      offset = dataStart + compressedSize;
    }
    return entries;
  }

  async function fileImportParse3mf(file) {
    const entries = await fileImportReadZipEntries(file);
    const textEntries = [];
    for (const entry of entries) {
      if (!entry.bytes) continue;
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".gcode") || lower.endsWith(".gco")) {
        const parsed = fileImportParseGcode(new TextDecoder().decode(entry.bytes), file.name);
        parsed.kind = "3mf-gcode";
        parsed.notes.unshift(`G-code interno encontrado em ${entry.name}`);
        return parsed;
      }
      if (lower.endsWith(".model") || lower.endsWith(".xml") || lower.endsWith(".config") || lower.endsWith(".txt")) {
        textEntries.push({ name: entry.name, text: new TextDecoder().decode(entry.bytes) });
      }
    }
    const allText = textEntries.map(entry => entry.text).join("\n");
    const nameMatch = allText.match(/<object[^>]+name="([^"]+)"/i) || allText.match(/<metadata[^>]+name="(?:Title|Name)"[^>]*>([^<]+)</i);
    const objectCount = (allText.match(/<object\b/gi) || []).length;
    const material = fileImportDetectMaterial(allText, file.name);
    return {
      kind: "3mf",
      fileName: file.name,
      project: (nameMatch?.[1] || file.name.replace(/\.3mf$/i, "")).trim(),
      material,
      grams: 0,
      hours: 0,
      objectCount,
      confidence: "parcial",
      notes: [
        objectCount ? `${objectCount} objeto(s) detectado(s) no 3MF` : "Modelo 3MF lido sem contagem de objetos",
        material ? `Material/metadado detectado: ${material}` : "Material não encontrado no 3MF",
        "Para cálculo automático completo, envie também o G-code fatiado."
      ]
    };
  }

  async function fileImportAnalyze(file) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".gcode") || lower.endsWith(".gco") || lower.endsWith(".gc")) {
      return fileImportParseGcode(await file.text(), file.name);
    }
    if (lower.endsWith(".3mf") || lower.endsWith(".zip")) return fileImportParse3mf(file);
    throw new Error("Formato não suportado. Use G-code ou 3MF.");
  }

  function fileImportSetValue(input, value) {
    if (!input || value === undefined || value === null || value === "") return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fileImportApplyToForm(form, result) {
    const qty = Math.max(1, fileImportNumber(form.quantidade_pecas?.value, 1));
    if (result.project && !String(form.projeto?.value || "").trim()) fileImportSetValue(form.projeto, result.project);
    if (result.material && form.material) fileImportSetValue(form.material, result.material);
    if (result.grams && form.peso_g) fileImportSetValue(form.peso_g, (result.grams / qty).toFixed(2));
    if (result.hours && form.horas) fileImportSetValue(form.horas, (result.hours / qty).toFixed(2));

    const currentObservation = String(form.observacao?.value || "").trim();
    const summary = [
      `Arquivo analisado: ${result.fileName}`,
      ...result.notes
    ].filter(Boolean).join("\n");
    if (form.observacao && !currentObservation.includes(result.fileName)) {
      fileImportSetValue(form.observacao, [currentObservation, summary].filter(Boolean).join("\n\n"));
    }
  }

  function fileImportResultHtml(result) {
    return `
      <strong>Arquivo analisado (${fileImportSafe(result.confidence)}): ${fileImportSafe(result.fileName)}</strong>
      <span>${result.grams ? `Peso: ${result.grams.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} g` : "Peso não localizado"} | ${result.hours ? `Tempo: ${result.hours.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h` : "Tempo não localizado"} | Material: ${fileImportSafe(result.material || "não identificado")}</span>
      <span>${fileImportSafe(result.kind === "3mf" ? "3MF lido como metadados. Para preço preciso, use o G-code fatiado." : "Campos do orçamento atualizados e valor recalculado.")}</span>`;
  }

  function fileImportAttachToBudgetForm() {
    const form = document.getElementById("budgetForm");
    if (!form || form.dataset.fileImportReady) return;
    form.dataset.fileImportReady = "true";
    const projectField = form.querySelector('[name="projeto"]')?.closest(".field") || form.querySelector(".form-grid")?.firstElementChild;
    if (!projectField) return;
    projectField.insertAdjacentHTML("afterend", `
      <div class="field span-2 budget-file-import">
        <label>Arquivo de fatiamento (.gcode/.3mf)</label>
        <input type="file" id="budgetFileImport" accept=".gcode,.gco,.gc,.3mf,.zip" />
        <small class="muted">O arquivo é lido somente no navegador. O sistema salva apenas peso, tempo, material e observação técnica.</small>
      </div>
      <div class="calc-box span-2 budget-file-import-result" id="budgetFileImportResult">Envie um G-code para preencher peso e tempo automaticamente. 3MF ajuda com metadados quando disponíveis.</div>`);
    const input = document.getElementById("budgetFileImport");
    const resultBox = document.getElementById("budgetFileImportResult");
    input?.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      resultBox.innerHTML = "Analisando arquivo local...";
      try {
        const result = await fileImportAnalyze(file);
        fileImportApplyToForm(form, result);
        resultBox.innerHTML = fileImportResultHtml(result);
        if (typeof showToast === "function") showToast("Arquivo analisado e orçamento recalculado.");
      } catch (error) {
        resultBox.innerHTML = `<strong>Não foi possível ler o arquivo.</strong><span>${fileImportSafe(error.message || error)}</span>`;
        if (typeof showToast === "function") showToast("Não foi possível ler este arquivo.");
      }
    });
  }

  if (typeof openBudgetForm === "function") {
    const previousOpenBudgetForm = openBudgetForm;
    openBudgetForm = function openBudgetFormWithFileImport(row = {}) {
      previousOpenBudgetForm(row);
      setTimeout(fileImportAttachToBudgetForm, 0);
    };
  }

  window.G3D_BUDGET_FILE_IMPORT = true;
})();
