import type { RecentSale } from "../store/types";

export type ReceiptProductContent = {
  sections?: { title: string; body: string }[];
};

export type ReceiptData = {
  storeName: string;
  logoUrl?: string;
  sale: RecentSale;
  productContent?: ReceiptProductContent;
};

const PT_PER_IN = 72;
const PX_PER_IN = 96;
const PX_TO_PT = PT_PER_IN / PX_PER_IN;
const A4_WIDTH_PT = 595.28;
const MARGIN_PT = PT_PER_IN;
const MARGIN_TOP_BOTTOM_PT = PT_PER_IN * 0.5;
const CONTENT_WIDTH_PT = A4_WIDTH_PT - MARGIN_PT * 2;
const CONTENT_WIDTH_PX = Math.round(CONTENT_WIDTH_PT / PX_TO_PT);

export function flexibleImageUrl(url?: string | null): string {
  const u = url ?? "";
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u) && !/\/image\/upload\/(f_|q_|w_)/.test(u)) {
    return u.replace(/(\/image\/upload\/)/, "$1f_auto,q_auto,w_600/");
  }
  return u;
}

export function parsePrice(price: string): number {
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(text: string): string {
  return esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdownToHtml(text: string): string {
  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    htmlParts.push(`<ul class="content-list">${listItems.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    htmlParts.push(
      `<table class="content-table">${tableRows.map((row) =>
        `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`
      ).join("")}</table>`
    );
    tableRows = [];
  };

  const parseTableRow = (line: string): string[] | null => {
    if (!line.trimStart().startsWith("|")) return null;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    return cells;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const row = parseTableRow(line);
    if (row) {
      flushList();
      tableRows.push(row);
    } else if (/^\s*-\s+/.test(line)) {
      flushTable();
      listItems.push(renderInlineMarkdown(line.replace(/^\s*-\s+/, "")));
    } else if (/^\s*#/.test(line)) {
      flushTable();
      flushList();
      htmlParts.push(`<p style="font-weight:600;margin:6px 0 2px">${renderInlineMarkdown(line.replace(/^\s*#\s*/, ""))}</p>`);
    } else if (line.trim() === "") {
      flushTable();
      flushList();
    } else {
      flushTable();
      flushList();
      htmlParts.push(`<p style="margin:2px 0">${renderInlineMarkdown(line)}</p>`);
    }
  }
  flushTable();
  flushList();
  return htmlParts.join("");
}

const RECEIPT_STYLES = `
  .receipt { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1a1a1a; width: 100%; max-width: 100%; margin: 0 auto; padding: 0; }
  .receipt *, .receipt *::before, .receipt *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .header { display: flex; align-items: center; justify-content: center; gap: 14px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .logo { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
  .header-text { display: flex; flex-direction: column; align-items: flex-start; }
  .store-name { font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .receipt-title { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; color: #444; }
  .receipt-no { font-size: 12px; margin-top: 6px; color: #666; }
  .product { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid #ddd; }
  .product img { width: 140px; height: 175px; object-fit: cover; border-radius: 4px; flex-shrink: 0; background: #f3f3f3; }
  .product-info { flex: 1; min-width: 0; }
  .product-name { font-size: 15px; font-weight: 600; }
  .product-meta { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
  table.totals { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.totals td { padding: 4px 0; font-size: 13px; }
  table.totals tr.grand td { border-top: 1px solid #1a1a1a; padding-top: 8px; font-weight: 700; font-size: 15px; }
  table.details { width: 100%; border-collapse: collapse; padding: 12px 0; }
  table.details td { font-size: 12px; padding: 3px 0; vertical-align: top; }
  table.details td:first-child { color: #666; width: 42%; }
  .section { padding: 12px 0; border-bottom: 1px solid #ddd; }
  .section-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
  .content-desc { font-size: 12px; color: #333; line-height: 1.6; margin-bottom: 8px; white-space: pre-line; }
  ul.content-list { list-style: disc; padding-left: 18px; }
  ul  .content-list li { font-size: 12px; color: #333; line-height: 1.6; }
  table.content-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
  table.content-table td { font-size: 12px; color: #333; padding: 3px 0; vertical-align: top; white-space: nowrap; }
  table.content-table td:first-child { font-weight: 600; padding-right: 12px; }
  .signatures { display: flex; gap: 24px; padding: 32px 0 8px; }
  .sig { flex: 1; text-align: center; }
  .sig-line { border-top: 1px solid #1a1a1a; margin-bottom: 5px; }
  .sig-label { font-size: 11px; color: #444; }
  .footer { text-align: center; font-size: 11px; color: #777; padding-top: 20px; line-height: 1.7; }
`;

function scopeReceiptCss(scope: string): string {
  return RECEIPT_STYLES.replace(/(^|\n)([^\n{@]+)\{/g, (_m, br, sel: string) => {
    const scoped = sel
      .trim()
      .split(",")
      .map((s) => `${scope} ${s.trim()}`)
      .join(",");
    return `${br}${scoped}{`;
  });
}

export function buildReceiptHtml({ storeName, logoUrl, sale, productContent }: ReceiptData): string {
  const unit = parsePrice(sale.price);
  const total = unit * sale.quantity;
  const image = flexibleImageUrl(sale.productImage);

  const sections = (productContent?.sections ?? []).filter((s) => s.title.trim() && s.body.trim());

  const contentSection =
    sections.length > 0
      ? `
  <div class="section">
    ${sections.map((s) => `
      <div class="section-label">${esc(s.title)}</div>
      <div class="content-desc">${renderMarkdownToHtml(s.body)}</div>
    `).join("")}
  </div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${esc(sale.receiptNo || sale.id)}</title>
<style>${RECEIPT_STYLES}
  html, body { margin: 0; background: #fff; }
  /* A4 page, 1in margin on every side, matching a standard Docs page setup.
     Long content simply flows onto additional A4 pages automatically. */
  @page { size: A4; margin: 0.5in 1in; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .receipt { width: auto; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${esc(flexibleImageUrl(logoUrl))}" alt="" onerror="this.style.display='none'" />` : ""}
    <div class="header-text">
      <div class="store-name">${esc(storeName)}</div>
      <div class="receipt-title">Sales Receipt</div>
      <div class="receipt-no">No. ${esc(sale.receiptNo || "—")}</div>
    </div>
  </div>

  <div class="product">
    ${image ? `<img src="${esc(image)}" alt="" onerror="this.style.display='none'" />` : ""}
    <div class="product-info">
      <div class="product-name">${esc(sale.productName)}</div>
      <div class="product-meta">
        ${sale.colorName ? `Color: ${esc(sale.colorName)}<br/>` : ""}
        ${sale.size ? `Size: ${esc(sale.size)}` : ""}
      </div>
      <table class="totals">
        <tr><td>Unit price</td><td style="text-align:right">${formatMoney(unit)}</td></tr>
        <tr><td>Quantity</td><td style="text-align:right">× ${sale.quantity}</td></tr>
        <tr class="grand"><td>Total</td><td style="text-align:right">${formatMoney(total)}</td></tr>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-label">Transaction Details</div>
    <table class="details">
      <tr><td>Date sold</td><td>${esc(formatDate(sale.soldAt))}</td></tr>
      <tr><td>Time of transaction</td><td>${esc(formatTime(sale.createdAt))}</td></tr>
      ${sale.soldBy ? `<tr><td>Sold by</td><td>${esc(sale.soldBy)}</td></tr>` : ""}
      ${sale.paymentMethod ? `<tr><td>Payment method</td><td>${esc(sale.paymentMethod)}</td></tr>` : ""}
    </table>
  </div>

  ${(sale.customerName || sale.customerPhone) ? `
  <div class="section">
    <div class="section-label">Customer</div>
    <table class="details">
      ${sale.customerName ? `<tr><td>Name</td><td>${esc(sale.customerName)}</td></tr>` : ""}
      ${sale.customerPhone ? `<tr><td>Contact no.</td><td>${esc(sale.customerPhone)}</td></tr>` : ""}
    </table>
  </div>` : ""}

  ${contentSection}

  <div class="signatures">
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Customer Signature</div>
    </div>
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Received by (Admin/Staff)</div>
    </div>
  </div>

  <div class="footer">
    Thank you for your purchase!<br/>
    Receipt generated on ${esc(formatDate(new Date().toISOString()))} at ${esc(formatTime(new Date().toISOString()))}
  </div>
</div>
</body>
</html>`;
}

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      })
    )
  );
}

export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const printWhenReady = async () => {
    await waitForImages(doc);
    win.focus();
    win.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  void printWhenReady();
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const parsed = new DOMParser().parseFromString(buildReceiptHtml(data), "text/html");

  const holder = document.createElement("div");
  holder.className = "receipt-root";
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${CONTENT_WIDTH_PX}px`;
  const styleEl = document.createElement("style");
  styleEl.textContent = scopeReceiptCss(".receipt-root");
  holder.appendChild(styleEl);
  holder.appendChild(parsed.body.firstElementChild as HTMLElement);
  document.body.appendChild(holder);

  try {
    await waitForImages(holder);
    const target = holder.querySelector(".receipt") as HTMLElement;
    target.style.padding = "0";
    target.style.paddingBottom = "24px";

    const SCALE = 3;
    const canvas = await html2canvas(target, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true });

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const availW = pageW - MARGIN_PT * 2;
    const availH = pageH - MARGIN_TOP_BOTTOM_PT * 2;

    const drawW = availW;
    const totalDrawH = (canvas.height / SCALE) * PX_TO_PT;

    if (totalDrawH <= availH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", MARGIN_PT, MARGIN_TOP_BOTTOM_PT, drawW, totalDrawH);
    } else {
      const OVERLAP_PX = 40 * SCALE;
      const sliceHeightPx = Math.floor((availH / PX_TO_PT) * SCALE);
      let yPx = 0;
      while (yPx < canvas.height) {
        const h = Math.min(sliceHeightPx, canvas.height - yPx);
        if (yPx > 0) pdf.addPage();
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = h;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(canvas, 0, yPx, canvas.width, h, 0, 0, canvas.width, h);
        pdf.addImage(
          slice.toDataURL("image/jpeg", 0.95),
          "JPEG",
          MARGIN_PT,
          MARGIN_TOP_BOTTOM_PT,
          drawW,
          Math.min((h / SCALE) * PX_TO_PT, availH)
        );
        yPx += h - (yPx + h < canvas.height ? OVERLAP_PX : 0);
      }
    }
    pdf.save(`Receipt-${data.sale.receiptNo || data.sale.id}.pdf`);
  } finally {
    holder.remove();
  }
}