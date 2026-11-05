import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Info,
} from 'lucide-react';
import Button from '../common/Button';
import { importTransactionsCsv, downloadSampleCsv } from '../../services/transactionApi';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export default function CsvImportModal({
  isOpen,
  onClose,
  onSuccess,
  sessionToken,
}) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const validateAndSetFile = (selectedFile) => {
    setErrorMessage(null);
    setImportResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Check extension
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv')) {
      setErrorMessage('Invalid file format. Please upload a file with a .csv extension.');
      setFile(null);
      return;
    }

    // Check size limit (2 MB)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`File exceeds the 2 MB size limit (selected file is ${sizeMb} MB).`);
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    validateAndSetFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    validateAndSetFile(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a CSV file first.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await importTransactionsCsv(sessionToken, file);
      setImportResult(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('CSV import failed:', err);
      let errorText = err.message || 'Failed to import CSV.';
      if (err.details && Array.isArray(err.details)) {
        errorText += `: Missing headers: ${err.details.join(', ')}`;
      }
      setErrorMessage(errorText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImportResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 border border-brand-200 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {importResult ? 'CSV Batch Import Summary' : 'Import Bank Statement (CSV)'}
              </h3>
              <p className="text-xs text-slate-500">
                {importResult
                  ? 'Batch parsing, deduplication, and fraud evaluation complete'
                  : 'Batch ingest transactions for automated fraud scoring (Max 2 MB)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {importResult ? (
            /* Import Results View */
            <div className="space-y-5">
              {/* Outcome Header Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                    Total Rows
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {importResult.summary?.total_rows ?? 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-700 font-semibold block">
                    Imported
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-800">
                    {importResult.summary?.imported_rows ?? 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold block">
                    Duplicates
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-800">
                    {importResult.summary?.duplicate_rows ?? 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[11px] uppercase tracking-wider text-rose-700 font-semibold block">
                    Rejected
                  </span>
                  <span className="text-xl font-bold font-mono text-rose-800">
                    {importResult.summary?.rejected_rows ?? 0}
                  </span>
                </div>
              </div>

              {/* Duplicate Details */}
              {importResult.results?.duplicates && importResult.results.duplicates.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Duplicates Skipped ({importResult.results.duplicates.length})</span>
                  </div>
                  <p className="text-amber-800 text-[11px] mb-2 leading-relaxed">
                    Identical merchant, amount, and timestamp records were safely deduplicated:
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {importResult.results.duplicates.map((dup, i) => (
                      <div key={i} className="text-amber-900 font-mono text-[11px] flex justify-between bg-amber-100/60 px-2 py-0.5 rounded">
                        <span>Row {dup.row}: {dup.merchant}</span>
                        <span>{dup.amount} {dup.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row-Specific Errors */}
              {importResult.results?.errors && importResult.results.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 text-xs">
                  <div className="flex items-center gap-1.5 text-rose-900 font-semibold mb-1">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Row Validation Errors ({importResult.results.errors.length})</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 mt-2">
                    {importResult.results.errors.map((err, i) => (
                      <div key={i} className="p-2 rounded bg-white/80 border border-rose-200 text-[11px] text-rose-900">
                        <span className="font-semibold font-mono">Row {err.row}: </span>
                        <span>{err.reason || (Array.isArray(err.errors) ? err.errors.map((e) => e.message || e).join('; ') : 'Validation failed')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success Message if 100% clean */}
              {importResult.summary?.rejected_rows === 0 && importResult.summary?.duplicate_rows === 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>All rows were successfully validated, scored for fraud risk, and saved.</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={handleReset}
                >
                  Import Another File
                </Button>
                <Button variant="primary" size="sm" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            /* Upload Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-brand-500 bg-brand-50/50'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-brand-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-white text-brand-600 border border-slate-200 flex items-center justify-center mb-3 shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800 flex items-center justify-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      {(file.size / 1024).toFixed(1)} KB — Ready to upload
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Click to choose file or drag & drop
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Strictly RFC 4180 .csv files up to 2 MB
                    </p>
                  </div>
                )}
              </div>

              {/* CSV Header Specification Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Info className="w-3.5 h-3.5 text-brand-600" />
                    <span>Required CSV Headers:</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    icon={Download}
                    onClick={downloadSampleCsv}
                    className="text-xs h-7 px-2.5"
                  >
                    Download Sample CSV
                  </Button>
                </div>
                <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200/80 text-slate-700 overflow-x-auto">
                  amount, currency, merchant_name, category, transaction_date
                </div>
                <p className="text-[11px] text-slate-500">
                  Supported currencies: USD, EUR, GBP, CAD, AUD, INR. Dates must be ISO 8601 or standard datetime.
                </p>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  disabled={!file}
                  icon={UploadCloud}
                >
                  Upload & Evaluate CSV
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
