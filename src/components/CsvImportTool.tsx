import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, X, Play } from 'lucide-react';
import { Startup, PipelineStatus } from '../types';
import { dbService } from '../services/dbService';

interface CsvImportToolProps {
  currentUser: { id: string; email: string };
  onImportSuccess: () => void;
}

export default function CsvImportTool({ currentUser, onImportSuccess }: CsvImportToolProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Partial<Startup>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [report, setReport] = useState<{ imported: number; skipped: number; logs: string[] } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Double quotes inside quotes means single literal quote
          currentField += '"';
          i++; // skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        row.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // End of row
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        row.push(currentField.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    // Push final field/row if any remaining
    if (currentField || row.length > 0) {
      row.push(currentField.trim());
      lines.push(row);
    }

    if (lines.length < 2) {
      setValidationErrors(['CSV file must contain a header row and at least one data row.']);
      return;
    }

    const fileHeaders = lines[0].map(h => h.trim());
    setHeaders(fileHeaders);

    const rows = lines.slice(1);
    const validatedRecords: Partial<Startup>[] = [];
    const errorsList: string[] = [];

    // Helper mapping map (keys in db, values in fileHeaders)
    const headerMapping: Record<string, string[]> = {
      company_name: ['company name', 'company', 'name', 'startup name', 'startup'],
      website: ['website', 'website url', 'url', 'site'],
      one_line_pitch: ['one-line pitch', 'pitch', 'one line pitch', 'tagline', 'description short'],
      description: ['description', 'about', 'company deep-dive', 'long description'],
      hq_location: ['hq location', 'location', 'hq', 'headquarters', 'city'],
      sector: ['sector', 'industry', 'category'],
      founder_name: ['founder name', 'founder', 'primary contact', 'contact name'],
      founder_email: ['founder email', 'email', 'contact email', 'founder\'s email'],
      founder_linkedin: ['founder linkedin', 'linkedin', 'founder\'s linkedin', 'linkedin profile'],
      team_size: ['team size', 'employees', 'fte', 'size'],
      team_background: ['team background', 'background', 'team pedigree', 'founders background'],
      stage: ['stage', 'company stage', 'funding stage'],
      funding_raised: ['funding raised', 'prior capital', 'raised', 'capital raised'],
      target_raise: ['target raise', 'asking', 'raise target', 'raising'],
      traction: ['traction', 'metrics', 'revenues', 'users'],
      demo_video: ['demo video', 'demo', 'video link', 'loom'],
      status: ['status', 'pipeline status', 'deal status']
    };

    // Find index of headers
    const findHeaderIndex = (keys: string[]): number => {
      return fileHeaders.findIndex(h => {
        const normalized = h.toLowerCase().trim().replace(/[^a-z0-9]/g, ' ');
        return keys.some(k => {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, ' ');
          return normalized === normKey || normalized.includes(normKey);
        });
      });
    };

    const indices: Record<string, number> = {};
    Object.keys(headerMapping).forEach(field => {
      indices[field] = findHeaderIndex(headerMapping[field]);
    });

    // Validate index mapping
    if (indices.company_name === -1) {
      errorsList.push("Required Column missing: 'Company Name' could not be mapped. Ensure your CSV has a company name column.");
    }

    rows.forEach((rowValues, rowIndex) => {
      const displayRowNumber = rowIndex + 2; // header is row 1
      if (rowValues.length < 1) return;

      const getValue = (field: string): string => {
        const idx = indices[field];
        return idx !== -1 && idx < rowValues.length ? rowValues[idx] : '';
      };

      const company_name = getValue('company_name');
      if (!company_name) {
        errorsList.push(`Row ${displayRowNumber}: Missing required Company Name.`);
        return;
      }

      const website = getValue('website') || 'https://example.com';
      const one_line_pitch = getValue('one_line_pitch') || 'Imported via CSV batch upload.';
      const description = getValue('description') || 'No description provided during CSV import.';
      const hq_location = getValue('hq_location') || 'Unknown HQ';
      const sector = getValue('sector') || 'SaaS';
      const founder_name = getValue('founder_name') || 'N/A';
      const founder_email = getValue('founder_email') || 'import@example.com';
      const founder_linkedin = getValue('founder_linkedin') || 'https://linkedin.com';
      const team_size = Number(getValue('team_size')) || 1;
      const team_background = getValue('team_background') || 'Background details unprovided.';
      const stage = getValue('stage') || 'Seed';
      const funding_raised = Number(getValue('funding_raised')) || 0;
      const target_raise = Number(getValue('target_raise')) || 500000;
      const traction = getValue('traction') || 'Traction data not provided.';
      const demo_video = getValue('demo_video') || '';
      const statusRaw = getValue('status') || 'New';

      // Status mapping validation
      let status: PipelineStatus = 'New';
      const validStatuses: PipelineStatus[] = ['New', 'Screening', 'Meeting', 'Due Diligence', 'Approved', 'Rejected', 'Archived'];
      const foundStatus = validStatuses.find(st => st.toLowerCase() === statusRaw.toLowerCase());
      if (foundStatus) {
        status = foundStatus;
      }

      validatedRecords.push({
        company_name,
        website,
        one_line_pitch,
        description,
        hq_location,
        sector,
        founder_name,
        founder_email,
        founder_linkedin,
        team_size,
        team_background,
        stage,
        funding_raised,
        target_raise,
        traction,
        demo_video,
        status
      });
    });

    setParsedData(validatedRecords);
    setValidationErrors(errorsList);
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setValidationErrors(['Only standard .csv file uploads are supported.']);
      return;
    }
    setCsvFile(file);
    setValidationErrors([]);
    setReport(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.onerror = () => {
      setValidationErrors(['Error reading CSV file.']);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0 || validationErrors.length > 0) return;

    setIsImporting(true);
    try {
      const res = await dbService.importCSV(parsedData, currentUser);
      setReport({
        imported: res.imported,
        skipped: res.skipped,
        logs: res.report
      });
      onImportSuccess();
      setCsvFile(null);
      setParsedData([]);
    } catch (e: any) {
      console.error(e);
      setValidationErrors([e.message || 'An error occurred during database batch insert.']);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setCsvFile(null);
    setParsedData([]);
    setHeaders([]);
    setValidationErrors([]);
    setReport(null);
  };

  return (
    <div className="space-y-6" id="csv-import-module">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
            CSV Import Tool
          </h2>
          <p className="text-neutral-500 text-xs mt-0.5">
            Batch import existing startup deal-flows from custom tables into the database.
          </p>
        </div>

        {parsedData.length > 0 && validationErrors.length === 0 && (
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-semibold text-xs rounded-lg inline-flex items-center gap-2 transition-colors shadow-xs"
            id="btn-run-csv-import"
          >
            {isImporting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Run Batch Import ({parsedData.length} records)
              </>
            )}
          </button>
        )}
      </div>

      {/* Report Summary */}
      {report && (
        <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-4" id="csv-import-report">
          <div className="flex items-center gap-2 text-neutral-900">
            <CheckCircle2 className="h-5 w-5 text-neutral-800" />
            <h3 className="font-semibold text-sm">Batch Import Complete</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="bg-white border border-neutral-200 p-3 rounded-lg text-center">
              <span className="text-lg font-bold text-neutral-900 block font-mono">{report.imported}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400">Imported</span>
            </div>
            <div className="bg-white border border-neutral-200 p-3 rounded-lg text-center">
              <span className="text-lg font-bold text-neutral-500 block font-mono">{report.skipped}</span>
              <span className="text-[10px] uppercase font-bold text-neutral-400">Skipped</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Import Log Reports</span>
            <div className="max-h-60 overflow-y-auto border border-neutral-200 rounded-lg p-3 bg-white text-xs font-mono space-y-1 text-neutral-600">
              {report.logs.map((log, index) => (
                <div key={index} className="flex gap-2 border-b border-neutral-50 pb-1">
                  <span className="text-neutral-400">[{index + 1}]</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors alert */}
      {validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-red-700 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>CSV Parsing / Formatting Failures</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          <button
            onClick={handleClear}
            className="text-[11px] underline font-medium hover:text-red-900 block mt-2"
          >
            Clear and choose another file
          </button>
        </div>
      )}

      {/* File Dropzone */}
      {!csvFile && !report && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-neutral-900 bg-neutral-50'
              : 'border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50/20'
          }`}
          id="csv_dropzone"
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="space-y-3 max-w-md mx-auto">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-50 border border-neutral-200">
              <FileSpreadsheet className="h-5 w-5 text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                Drag & Drop Startup Database CSV
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Supports spreadsheet exports. We automatically map columns for company name, sector, stage, founder contacts, raise target, traction, and pitch deck filenames.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-neutral-100 border border-neutral-200 rounded-md font-semibold text-neutral-700 hover:bg-neutral-200 transition-colors">
              Browse CSV File
            </span>
          </div>
        </div>
      )}

      {/* CSV Parser Preview Grid */}
      {parsedData.length > 0 && validationErrors.length === 0 && (
        <div className="space-y-3" id="csv-preview-table">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono">
              CSV Data Mapping Preview ({parsedData.length} entries detected)
            </h3>
            <button
              onClick={handleClear}
              className="text-xs font-semibold text-neutral-400 hover:text-neutral-900 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Clear File
            </button>
          </div>

          <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-250 font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                    <th className="px-4 py-2.5">Company Name</th>
                    <th className="px-4 py-2.5">Sector</th>
                    <th className="px-4 py-2.5">Stage</th>
                    <th className="px-4 py-2.5">Target Raise</th>
                    <th className="px-4 py-2.5">Founder</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {parsedData.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50/50">
                      <td className="px-4 py-2.5 font-semibold text-neutral-900">{row.company_name}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{row.sector}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{row.stage}</td>
                      <td className="px-4 py-2.5 font-mono text-neutral-900">
                        ${row.target_raise?.toLocaleString() || '0'}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-600">{row.founder_name}</td>
                      <td className="px-4 py-2.5 text-neutral-600 font-mono">{row.founder_email}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{row.hq_location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
