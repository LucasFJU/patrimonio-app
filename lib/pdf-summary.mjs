import {CATEGORIES,calculate,dateISO,money} from './portfolio.mjs';
import {DEFAULT_FINANCE,monthOf,summarizeFinance} from './finance.mjs';

function pdfEscape(text) {
  const str = String(text ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[•‣]/g, '\u00B7')
    .replace(/[—–]/g, '-');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    const ch = str[i];
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += '\\' + ch;
    } else if (code >= 32 && code <= 126) {
      out += ch;
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      out += '?';
    }
  }
  return out;
}

function rgb(r, g, b) {
  return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
}

function estimateTextWidth(text, size = 10, bold = false) {
  const str = String(text ?? '').replace(/\u00A0/g, ' ');
  let units = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if ('ilI.,:;!| '.includes(ch)) units += 0.28;
    else if ('ftrj()[]/-'.includes(ch)) units += 0.35;
    else if ('mwMW@%'.includes(ch)) units += 0.82;
    else if (ch >= 'A' && ch <= 'Z') units += 0.68;
    else if (ch >= '0' && ch <= '9') units += 0.56;
    else units += 0.54;
  }
  return units * size * (bold ? 1.04 : 1);
}

export function buildMonthlySummaryData(state, referenceDate = dateISO()) {
  const currentMonth = referenceDate.slice(0, 7);
  const calc = calculate(state, referenceDate);
  const finance = state?.finance || DEFAULT_FINANCE();
  const monthSummary = summarizeFinance(finance, currentMonth);

  const investedTotal = calc.total || 0;
  const cashAccountsTotal = monthSummary.cash || 0;
  const netWorthTotal = investedTotal + cashAccountsTotal;

  const categoryCounts = {};
  let expenseTransactionsCount = 0;
  for (const t of finance.transactions || []) {
    const compMonth = t.competenceMonth || monthOf(t.date || '');
    if (
      compMonth === currentMonth &&
      t.date <= referenceDate &&
      !t.needsReview &&
      !t.excludedFromBalances &&
      !t.supersededByPluggyTransactionId &&
      (t.type === 'expense' || t.type === 'card_purchase')
    ) {
      const cat = t.category || 'Outros';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      expenseTransactionsCount += 1;
    }
  }

  const categoryRows = Object.entries(monthSummary.expensesByCategory || {})
    .map(([name, value]) => ({
      name,
      count: categoryCounts[name] || 1,
      value,
      share: monthSummary.expenses > 0 ? (value / monthSummary.expenses) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const assetClasses = Object.entries(CATEGORIES)
    .map(([key, label]) => {
      const value = (state?.assets || [])
        .filter(a => a.category === key)
        .reduce((sum, a) => sum + (calc.values[a.id] || 0), 0);
      return {
        key,
        label,
        value,
        share: investedTotal > 0 ? (value / investedTotal) * 100 : 0,
      };
    })
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    currentMonth,
    referenceDate,
    profileName: state?.settings?.name || 'Família',
    netWorthTotal,
    investedTotal,
    cashAccountsTotal,
    reserveTotal: calc.reserve || 0,
    netInvested: calc.netInvested || 0,
    accumulatedGain: calc.gain || 0,
    monthIncome: monthSummary.income || 0,
    monthExpenses: monthSummary.expenses || 0,
    monthInvestments: monthSummary.investments || 0,
    monthDueCards: monthSummary.due || 0,
    monthBalance: (monthSummary.income || 0) - (monthSummary.expenses || 0),
    expenseTransactionsCount,
    categoryRows,
    assetClasses,
  };
}

export function generateSummaryPdf(state, { referenceDate = dateISO(), maskValues = false } = {}) {
  const data = buildMonthlySummaryData(state, referenceDate);
  const fmt = val => (maskValues ? 'R$ *****' : money(val));
  const monthLabel = new Date(`${data.currentMonth}-15T12:00:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const generatedLabel = new Date(`${data.referenceDate}T12:00:00`).toLocaleDateString('pt-BR');

  const ops = [];
  const rectFill = (x, y, w, h, color) => {
    ops.push(`${color} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`);
  };
  const rectStroke = (x, y, w, h, color, lineWidth = 1) => {
    ops.push(`${lineWidth.toFixed(1)} w ${color} RG ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S`);
  };
  const drawLine = (x1, y1, x2, y2, color, lineWidth = 0.8) => {
    ops.push(`${lineWidth.toFixed(1)} w ${color} RG ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  };
  const text = (x, y, str, { size = 10, bold = false, color = rgb(30, 31, 32) } = {}) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(str)}) Tj ET`);
  };
  const textRight = (rightX, y, str, { size = 10, bold = false, color = rgb(30, 31, 32) } = {}) => {
    const w = estimateTextWidth(str, size, bold);
    text(Math.max(32, rightX - w), y, str, { size, bold, color });
  };

  // Page Background
  rectFill(0, 0, 595, 842, rgb(248, 250, 252));

  // Header Banner with Clear Title & Reference Date Box
  rectFill(32, 732, 531, 80, rgb(24, 28, 32));
  rectFill(32, 808, 531, 4, rgb(238, 248, 128));

  text(48, 790, 'RELATORIO EXECUTIVO MENSAL · PATRIMONIO & FINANCAS', {
    size: 8.5,
    bold: true,
    color: rgb(238, 248, 128),
  });
  text(48, 767, 'Resumo Financeiro e Patrimonial', {
    size: 17,
    bold: true,
    color: rgb(255, 255, 255),
  });
  text(48, 747, `Perfil: ${data.profileName}   ·   Competencia: ${monthLabelCap}`, {
    size: 9.5,
    color: rgb(203, 213, 225),
  });

  // Reference Date Highlight Box inside Header
  rectFill(392, 742, 157, 56, rgb(36, 42, 48));
  rectStroke(392, 742, 157, 56, rgb(64, 74, 86), 0.8);
  text(404, 783, 'DATA DE REFERENCIA', {
    size: 7.5,
    bold: true,
    color: rgb(238, 248, 128),
  });
  text(404, 765, generatedLabel, {
    size: 13,
    bold: true,
    color: rgb(255, 255, 255),
  });
  text(404, 750, `Mes atual: ${data.currentMonth}`, {
    size: 8,
    color: rgb(178, 209, 206),
  });

  // KPI Card 1: Patrimônio Total Consolidado (Left)
  const cardY = 598;
  const cardH = 120;
  rectFill(32, cardY, 258, cardH, rgb(255, 255, 255));
  rectStroke(32, cardY, 258, cardH, rgb(203, 213, 225), 1);
  rectFill(32, cardY + cardH - 4, 258, 4, rgb(16, 185, 129));

  text(46, cardY + 96, 'PATRIMONIO TOTAL CONSOLIDADO', {
    size: 8.5,
    bold: true,
    color: rgb(100, 116, 139),
  });
  text(46, cardY + 72, fmt(data.netWorthTotal), {
    size: 18,
    bold: true,
    color: rgb(15, 23, 42),
  });
  drawLine(46, cardY + 61, 276, cardY + 61, rgb(226, 232, 240), 0.8);

  text(46, cardY + 45, 'Carteira investida', { size: 9, color: rgb(71, 85, 105) });
  textRight(276, cardY + 45, fmt(data.investedTotal), { size: 9, bold: true, color: rgb(15, 23, 42) });

  text(46, cardY + 29, 'Saldo em contas bancarias', { size: 9, color: rgb(71, 85, 105) });
  textRight(276, cardY + 29, fmt(data.cashAccountsTotal), { size: 9, bold: true, color: rgb(15, 23, 42) });

  text(46, cardY + 13, 'Reserva de liquidez', { size: 9, bold: true, color: rgb(16, 185, 129) });
  textRight(276, cardY + 13, fmt(data.reserveTotal), { size: 9, bold: true, color: rgb(16, 185, 129) });

  // KPI Card 2: Despesas & Fluxo do Mês Atual (Right)
  rectFill(305, cardY, 258, cardH, rgb(255, 255, 255));
  rectStroke(305, cardY, 258, cardH, rgb(203, 213, 225), 1);
  rectFill(305, cardY + cardH - 4, 258, 4, rgb(245, 158, 11));

  text(319, cardY + 96, `DESPESAS DO MES (${data.currentMonth})`, {
    size: 8.5,
    bold: true,
    color: rgb(100, 116, 139),
  });
  text(319, cardY + 72, fmt(data.monthExpenses), {
    size: 18,
    bold: true,
    color: rgb(15, 23, 42),
  });
  drawLine(319, cardY + 61, 549, cardY + 61, rgb(226, 232, 240), 0.8);

  text(319, cardY + 45, 'Receitas confirmadas no mes', { size: 9, color: rgb(71, 85, 105) });
  textRight(549, cardY + 45, fmt(data.monthIncome), { size: 9, bold: true, color: rgb(15, 23, 42) });

  text(319, cardY + 29, 'Aportes / Faturas em aberto', { size: 9, color: rgb(71, 85, 105) });
  textRight(549, cardY + 29, `${fmt(data.monthInvestments)} / ${fmt(data.monthDueCards)}`, {
    size: 8.5,
    bold: true,
    color: rgb(51, 65, 85),
  });

  text(319, cardY + 13, 'Resultado liquido (Receitas - Despesas)', {
    size: 8.5,
    bold: true,
    color: data.monthBalance >= 0 ? rgb(16, 185, 129) : rgb(220, 38, 38),
  });
  textRight(549, cardY + 13, `${data.monthBalance >= 0 ? '+' : ''}${fmt(data.monthBalance)}`, {
    size: 9,
    bold: true,
    color: data.monthBalance >= 0 ? rgb(16, 185, 129) : rgb(220, 38, 38),
  });

  // Visual Ratio Strip: Receitas vs Despesas do Mês
  const stripY = 536;
  rectFill(32, stripY, 531, 48, rgb(255, 255, 255));
  rectStroke(32, stripY, 531, 48, rgb(203, 213, 225), 1);
  const flowBase = Math.max(data.monthIncome, data.monthExpenses, 1);
  const incW = Math.max(6, Math.min(499, (data.monthIncome / flowBase) * 499));
  const expW = Math.max(6, Math.min(499, (data.monthExpenses / flowBase) * 499));
  text(48, stripY + 32, `Termometro de caixa no mes: Receitas (${fmt(data.monthIncome)}) vs. Despesas (${fmt(data.monthExpenses)})`, {
    size: 8.8,
    bold: true,
    color: rgb(51, 65, 85),
  });
  rectFill(48, stripY + 19, 499, 6.5, rgb(241, 245, 249));
  rectFill(48, stripY + 19, incW, 6.5, rgb(16, 185, 129));
  rectFill(48, stripY + 9, 499, 6.5, rgb(241, 245, 249));
  rectFill(48, stripY + 9, expW, 6.5, rgb(245, 158, 11));

  // Section 1: Tabela Organizada de Categorias de Despesas
  let cursorY = 512;
  text(32, cursorY, `1. Tabela de Despesas por Categoria (${monthLabelCap})`, {
    size: 11.5,
    bold: true,
    color: rgb(15, 23, 42),
  });
  textRight(
    563,
    cursorY,
    `${data.categoryRows.length} ${data.categoryRows.length === 1 ? 'categoria' : 'categorias'} · ${data.expenseTransactionsCount} ${data.expenseTransactionsCount === 1 ? 'lancamento' : 'lancamentos'}`,
    { size: 8.5, color: rgb(100, 116, 139) }
  );

  const tableTopY = cursorY - 10;
  const headerH = 22;
  const rowH = 22;
  const footerH = 24;

  // Prepare up to 8 table rows (consolidating remaining if > 8)
  const displayCategories =
    data.categoryRows.length <= 8
      ? data.categoryRows
      : [
          ...data.categoryRows.slice(0, 7),
          data.categoryRows.slice(7).reduce(
            (acc, r) => ({
              name: 'Outras categorias',
              count: acc.count + r.count,
              value: acc.value + r.value,
              share: acc.share + r.share,
            }),
            { name: 'Outras categorias', count: 0, value: 0, share: 0 }
          ),
        ];

  // Table Header
  rectFill(32, tableTopY - headerH, 531, headerH, rgb(30, 41, 59));
  text(42, tableTopY - 14.5, '#', { size: 8, bold: true, color: rgb(203, 213, 225) });
  text(64, tableTopY - 14.5, 'CATEGORIA DE DESPESA', { size: 8, bold: true, color: rgb(255, 255, 255) });
  text(230, tableTopY - 14.5, 'QTD.', { size: 8, bold: true, color: rgb(203, 213, 225) });
  text(295, tableTopY - 14.5, 'PARTICIPACAO (%)', { size: 8, bold: true, color: rgb(203, 213, 225) });
  textRight(551, tableTopY - 14.5, 'VALOR NO MES (R$)', { size: 8, bold: true, color: rgb(238, 248, 128) });

  let currentRowTop = tableTopY - headerH;

  if (displayCategories.length === 0) {
    rectFill(32, currentRowTop - 36, 531, 36, rgb(255, 255, 255));
    rectStroke(32, currentRowTop - 36, 531, 36, rgb(203, 213, 225), 0.8);
    text(46, currentRowTop - 22, 'Nenhuma despesa confirmada registrada para o mes de referencia.', {
      size: 9.5,
      color: rgb(100, 116, 139),
    });
    currentRowTop -= 36;
  } else {
    displayCategories.forEach((row, index) => {
      const rowBottom = currentRowTop - rowH;
      const bg = index % 2 === 0 ? rgb(255, 255, 255) : rgb(248, 250, 252);
      rectFill(32, rowBottom, 531, rowH, bg);
      drawLine(32, rowBottom, 563, rowBottom, rgb(226, 232, 240), 0.7);

      const textY = rowBottom + 7;
      text(42, textY, String(index + 1).padStart(2, '0'), {
        size: 8.5,
        bold: true,
        color: rgb(100, 116, 139),
      });
      text(64, textY, row.name, {
        size: 9.5,
        bold: true,
        color: rgb(15, 23, 42),
      });
      text(230, textY, `${row.count} ${row.count === 1 ? 'item' : 'itens'}`, {
        size: 8.5,
        color: rgb(71, 85, 105),
      });

      const barX = 295;
      const barMaxW = 96;
      const fillW = Math.max(3, Math.min(barMaxW, (row.share / 100) * barMaxW));
      rectFill(barX, textY + 1, barMaxW, 6, rgb(226, 232, 240));
      rectFill(barX, textY + 1, fillW, 6, rgb(245, 158, 11));
      text(400, textY, `${row.share.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, {
        size: 8.5,
        bold: true,
        color: rgb(71, 85, 105),
      });

      textRight(551, textY, fmt(row.value), {
        size: 9.5,
        bold: true,
        color: rgb(15, 23, 42),
      });

      currentRowTop = rowBottom;
    });

    // Table Total Footer Row
    const footerBottom = currentRowTop - footerH;
    rectFill(32, footerBottom, 531, footerH, rgb(241, 245, 249));
    drawLine(32, currentRowTop, 563, currentRowTop, rgb(148, 163, 184), 1);
    text(64, footerBottom + 8, 'TOTAL DE DESPESAS DO MES', {
      size: 9,
      bold: true,
      color: rgb(15, 23, 42),
    });
    text(230, footerBottom + 8, `${data.expenseTransactionsCount} ${data.expenseTransactionsCount === 1 ? 'item' : 'itens'}`, {
      size: 8.5,
      bold: true,
      color: rgb(51, 65, 85),
    });
    text(400, footerBottom + 8, '100,0%', {
      size: 8.5,
      bold: true,
      color: rgb(51, 65, 85),
    });
    textRight(551, footerBottom + 8, fmt(data.monthExpenses), {
      size: 10,
      bold: true,
      color: rgb(15, 23, 42),
    });
    currentRowTop = footerBottom;
    rectStroke(32, currentRowTop, 531, tableTopY - currentRowTop, rgb(203, 213, 225), 1);
  }

  // Section 2: Tabela de Composição do Patrimônio Investido
  cursorY = currentRowTop - 22;
  text(32, cursorY, '2. Composicao do Patrimonio Investido por Classe', {
    size: 11.5,
    bold: true,
    color: rgb(15, 23, 42),
  });
  textRight(563, cursorY, `Carteira: ${fmt(data.investedTotal)}`, {
    size: 8.5,
    bold: true,
    color: rgb(16, 185, 129),
  });

  const assetTableTop = cursorY - 10;
  const assetHeaderH = 20;
  const assetRowH = 20;
  const classes = data.assetClasses.slice(0, 6);

  rectFill(32, assetTableTop - assetHeaderH, 531, assetHeaderH, rgb(30, 41, 59));
  text(46, assetTableTop - 13.5, 'CLASSE DE ATIVO', { size: 8, bold: true, color: rgb(255, 255, 255) });
  text(295, assetTableTop - 13.5, 'ALOCACAO NA CARTEIRA (%)', { size: 8, bold: true, color: rgb(203, 213, 225) });
  textRight(551, assetTableTop - 13.5, 'SALDO ATUAL (R$)', { size: 8, bold: true, color: rgb(238, 248, 128) });

  let assetRowTop = assetTableTop - assetHeaderH;
  if (classes.length === 0) {
    rectFill(32, assetRowTop - 32, 531, 32, rgb(255, 255, 255));
    rectStroke(32, assetRowTop - 32, 531, 32, rgb(203, 213, 225), 0.8);
    text(46, assetRowTop - 20, 'Nenhuma posicao investida cadastrada no momento.', {
      size: 9.5,
      color: rgb(100, 116, 139),
    });
  } else {
    classes.forEach((row, index) => {
      const rowBottom = assetRowTop - assetRowH;
      const bg = index % 2 === 0 ? rgb(255, 255, 255) : rgb(248, 250, 252);
      rectFill(32, rowBottom, 531, assetRowH, bg);
      drawLine(32, rowBottom, 563, rowBottom, rgb(226, 232, 240), 0.7);

      const textY = rowBottom + 6;
      text(46, textY, row.label, { size: 9, bold: true, color: rgb(15, 23, 42) });

      const barX = 295;
      const barMaxW = 96;
      const fillW = Math.max(3, Math.min(barMaxW, (row.share / 100) * barMaxW));
      rectFill(barX, textY + 1, barMaxW, 6, rgb(226, 232, 240));
      rectFill(barX, textY + 1, fillW, 6, rgb(16, 185, 129));
      text(400, textY, `${row.share.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, {
        size: 8.5,
        bold: true,
        color: rgb(71, 85, 105),
      });

      textRight(551, textY, fmt(row.value), { size: 9, bold: true, color: rgb(15, 23, 42) });
      assetRowTop = rowBottom;
    });
    rectStroke(32, assetRowTop, 531, assetTableTop - assetRowTop, rgb(203, 213, 225), 1);
  }

  // Footer
  drawLine(32, 42, 563, 42, rgb(226, 232, 240), 0.8);
  text(32, 27, 'Patrimonio · Controle Financeiro e Custodia Consolidada', {
    size: 8,
    color: rgb(100, 116, 139),
  });
  textRight(563, 27, `Data de referencia: ${generatedLabel} · Pagina 1 de 1`, {
    size: 8,
    color: rgb(100, 116, 139),
  });

  const contentStream = ops.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}
