import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportOptions {
  filename?: string;
  title?: string;
  subtitle?: string;
  includeDate?: boolean;
  includeLogo?: boolean;
  pageSize?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

interface ChartData {
  humanDesign?: {
    energyType: string;
    authority: string;
    profile: string;
    incarnationCross: string;
    definedCenters: string[];
    gates: Array<{
      number: number;
      line: number;
      planet: string;
    }>;
    channels: Array<{
      gate1: number;
      gate2: number;
    }>;
  };
  numerology?: {
    lifePath: number;
    destiny: number;
    soulUrge: number;
    personality: number;
    maturity: number;
    birthDay: number;
    expression: number;
  };
  geneKeys?: {
    lifeTheme: number;
    radiance: number;
    purpose: number;
    attraction: number;
    pearl: string;
  };
  birthData?: {
    date: string;
    time: string;
    location: string;
  };
}

const defaultOptions: ExportOptions = {
  filename: 'synthesis-report.pdf',
  title: 'Mein Synthesis Engine Report',
  subtitle: 'Human Design, Numerologie & Gene Keys',
  includeDate: true,
  includeLogo: true,
  pageSize: 'a4',
  orientation: 'portrait',
};

// Generate PDF from HTML element
export async function exportElementToPDF(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  try {
    // Create canvas from element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#0f0f23',
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: opts.orientation,
      unit: 'mm',
      format: opts.pageSize,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    let imgY = 20; // Top margin

    // Add header
    if (opts.includeLogo) {
      pdf.setFontSize(24);
      pdf.setTextColor(139, 92, 246); // Violet
      pdf.text('Synthesis Engine', pdfWidth / 2, 15, { align: 'center' });
    }

    // Add title
    if (opts.title) {
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text(opts.title, pdfWidth / 2, imgY, { align: 'center' });
      imgY += 10;
    }

    // Add subtitle
    if (opts.subtitle) {
      pdf.setFontSize(12);
      pdf.setTextColor(200, 200, 200);
      pdf.text(opts.subtitle, pdfWidth / 2, imgY, { align: 'center' });
      imgY += 10;
    }

    // Add date
    if (opts.includeDate) {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      const dateStr = new Date().toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      pdf.text(`Erstellt am: ${dateStr}`, pdfWidth / 2, imgY, { align: 'center' });
      imgY += 15;
    }

    // Add image
    pdf.addImage(
      imgData,
      'PNG',
      imgX,
      imgY,
      imgWidth * ratio,
      imgHeight * ratio
    );

    // Add footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Seite ${i} von ${pageCount} | Synthesis Engine © ${new Date().getFullYear()}`,
        pdfWidth / 2,
        pdfHeight - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    pdf.save(opts.filename);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDF-Export fehlgeschlagen');
  }
}

// Generate comprehensive report PDF
export async function generateFullReport(
  chartData: ChartData,
  options: ExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options };
  
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.pageSize,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  let yPos = 20;

  // Helper to add text with wrapping
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    const maxWidth = options.maxWidth || pdfWidth - 40;
    const lineHeight = options.lineHeight || 7;
    const fontSize = options.fontSize || 12;
    
    pdf.setFontSize(fontSize);
    if (options.color) {
      pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
    }
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, x, y);
    return lines.length * lineHeight;
  };

  // Header
  pdf.setFillColor(15, 15, 35);
  pdf.rect(0, 0, pdfWidth, 40, 'F');
  
  pdf.setFontSize(24);
  pdf.setTextColor(139, 92, 246);
  pdf.text('Synthesis Engine', pdfWidth / 2, 20, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text(opts.title || 'Persönlicher Report', pdfWidth / 2, 30, { align: 'center' });

  yPos = 50;

  // Birth Data Section
  if (chartData.birthData) {
    pdf.setFontSize(16);
    pdf.setTextColor(139, 92, 246);
    pdf.text('Geburtsdaten', 20, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setTextColor(200, 200, 200);
    pdf.text(`Datum: ${chartData.birthData.date}`, 20, yPos);
    yPos += 7;
    pdf.text(`Zeit: ${chartData.birthData.time}`, 20, yPos);
    yPos += 7;
    pdf.text(`Ort: ${chartData.birthData.location}`, 20, yPos);
    yPos += 15;
  }

  // Human Design Section
  if (chartData.humanDesign) {
    pdf.setFontSize(16);
    pdf.setTextColor(139, 92, 246);
    pdf.text('Human Design', 20, yPos);
    yPos += 10;

    const hd = chartData.humanDesign;
    
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Energie-Typ: ${hd.energyType}`, 20, yPos);
    yPos += 7;
    pdf.text(`Autorität: ${hd.authority}`, 20, yPos);
    yPos += 7;
    pdf.text(`Profil: ${hd.profile}`, 20, yPos);
    yPos += 7;
    pdf.text(`Inkarnationskreuz: ${hd.incarnationCross}`, 20, yPos);
    yPos += 10;

    // Gates
    if (hd.gates.length > 0) {
      pdf.setFontSize(12);
      pdf.setTextColor(200, 200, 200);
      pdf.text('Aktive Gates:', 20, yPos);
      yPos += 7;

      const gateText = hd.gates
        .map(g => `Tor ${g.number} (Linie ${g.line}) - ${g.planet}`)
        .join(', ');
      
      yPos += addText(gateText, 20, yPos, { fontSize: 10, maxWidth: pdfWidth - 40 });
      yPos += 10;
    }

    // Channels
    if (hd.channels.length > 0) {
      pdf.setFontSize(12);
      pdf.setTextColor(200, 200, 200);
      pdf.text('Aktive Kanäle:', 20, yPos);
      yPos += 7;

      hd.channels.forEach(channel => {
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Kanal ${channel.gate1}-${channel.gate2}`, 25, yPos);
        yPos += 5;
      });
      yPos += 10;
    }
  }

  // Numerology Section
  if (chartData.numerology) {
    // Check if we need a new page
    if (yPos > pdfHeight - 80) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(16);
    pdf.setTextColor(139, 92, 246);
    pdf.text('Numerologie (Dan Millman)', 20, yPos);
    yPos += 10;

    const num = chartData.numerology;
    
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Lebensweg: ${num.lifePath}`, 20, yPos);
    yPos += 7;
    pdf.text(`Schicksalszahl: ${num.destiny}`, 20, yPos);
    yPos += 7;
    pdf.text(`Seelenverlangen: ${num.soulUrge}`, 20, yPos);
    yPos += 7;
    pdf.text(`Persönlichkeit: ${num.personality}`, 20, yPos);
    yPos += 7;
    pdf.text(`Reifezahl: ${num.maturity}`, 20, yPos);
    yPos += 7;
    pdf.text(`Geburtstagszahl: ${num.birthDay}`, 20, yPos);
    yPos += 7;
    pdf.text(`Ausdruckszahl: ${num.expression}`, 20, yPos);
    yPos += 15;
  }

  // Gene Keys Section
  if (chartData.geneKeys) {
    // Check if we need a new page
    if (yPos > pdfHeight - 60) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(16);
    pdf.setTextColor(139, 92, 246);
    pdf.text('Gene Keys', 20, yPos);
    yPos += 10;

    const gk = chartData.geneKeys;
    
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Lebensthema (Sonne): Gene Key ${gk.lifeTheme}`, 20, yPos);
    yPos += 7;
    pdf.text(`Radiance (Erde): Gene Key ${gk.radiance}`, 20, yPos);
    yPos += 7;
    pdf.text(`Lebenszweck (Jupiter): Gene Key ${gk.purpose}`, 20, yPos);
    yPos += 7;
    pdf.text(`Attraktion (Venus): Gene Key ${gk.attraction}`, 20, yPos);
    yPos += 7;
    pdf.text(`Perle: ${gk.pearl}`, 20, yPos);
    yPos += 15;
  }

  // Footer on all pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `Seite ${i} von ${pageCount} | Synthesis Engine © ${new Date().getFullYear()}`,
      pdfWidth / 2,
      pdfHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  pdf.save(opts.filename);
}

// Export journal entries as PDF
export async function exportJournalToPDF(
  entries: Array<{
    title: string;
    date: string;
    content: string;
    tags: string[];
    mood?: string;
  }>,
  options: ExportOptions = {}
): Promise<void> {
  const opts = { ...defaultOptions, ...options, filename: 'synthesis-journal.pdf' };
  
  const pdf = new jsPDF({
    orientation: opts.orientation,
    unit: 'mm',
    format: opts.pageSize,
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFillColor(15, 15, 35);
  pdf.rect(0, 0, pdfWidth, 30, 'F');
  
  pdf.setFontSize(20);
  pdf.setTextColor(139, 92, 246);
  pdf.text('Synthesis Journal', pdfWidth / 2, 15, { align: 'center' });
  
  pdf.setFontSize(10);
  pdf.setTextColor(150, 150, 150);
  pdf.text(
    `Export vom ${new Date().toLocaleDateString('de-DE')}`,
    pdfWidth / 2,
    25,
    { align: 'center' }
  );

  let yPos = 40;

  entries.forEach((entry, index) => {
    // Check if we need a new page
    if (yPos > pdfHeight - 60) {
      pdf.addPage();
      yPos = 20;
    }

    // Entry title
    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(entry.title, 20, yPos);
    yPos += 7;

    // Date and mood
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    let metaText = new Date(entry.date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (entry.mood) {
      metaText += ` | Stimmung: ${entry.mood}`;
    }
    pdf.text(metaText, 20, yPos);
    yPos += 7;

    // Tags
    if (entry.tags.length > 0) {
      pdf.setFontSize(8);
      pdf.setTextColor(139, 92, 246);
      pdf.text(`Tags: ${entry.tags.join(', ')}`, 20, yPos);
      yPos += 7;
    }

    // Content
    pdf.setFontSize(10);
    pdf.setTextColor(200, 200, 200);
    const lines = pdf.splitTextToSize(entry.content, pdfWidth - 40);
    pdf.text(lines, 20, yPos);
    yPos += lines.length * 5 + 10;

    // Separator
    if (index < entries.length - 1) {
      pdf.setDrawColor(50, 50, 50);
      pdf.line(20, yPos - 5, pdfWidth - 20, yPos - 5);
      yPos += 10;
    }
  });

  // Footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `Seite ${i} von ${pageCount} | Synthesis Engine © ${new Date().getFullYear()}`,
      pdfWidth / 2,
      pdfHeight - 10,
      { align: 'center' }
    );
  }

  pdf.save(opts.filename);
}

// Quick export function for charts
export async function quickExportChart(
  elementId: string,
  filename?: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element nicht gefunden');
  }

  await exportElementToPDF(element, {
    filename: filename || 'synthesis-chart.pdf',
    title: 'Mein Synthesis Chart',
    includeDate: true,
  });
}
