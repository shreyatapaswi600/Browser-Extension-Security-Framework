import DashboardLayout from '../pages/layout';
import { UploadCloud, CheckCircle, Settings2 } from 'lucide-react';

export default function AnalyzeExtension() {
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Analyze Extension</h1>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-white border rounded text-sm flex items-center gap-2">
             CLI Pipe Docs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Upload & Pipeline */}
        <div className="col-span-2 space-y-6">
          {/* Upload Section */}
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center border-dashed border-2">
            <UploadCloud className="mx-auto h-12 w-12 text-teal-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Drag and drop an extension ZIP package here</h3>
            <p className="text-sm text-slate-500 mt-1">or browse local filesystem</p>
            <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
              <span className="bg-slate-100 px-2 py-1 rounded">.ZIP archive</span>
              <span className="bg-slate-100 px-2 py-1 rounded">.CRX</span>
            </div>
          </div>

          {/* Pipeline Section */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="bg-teal-100 text-teal-700 p-1 rounded-full text-xs">02</span>
              Dynamic Analysis Pipeline
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-500 mt-1" />
                <div>
                  <h4 className="font-bold text-sm">Upload & Archive Extraction</h4>
                  <p className="text-xs text-slate-500">Package inflated: 30 files verified...</p>
                </div>
              </div>
              {/* Add other pipeline steps similarly */}
            </div>
          </div>
        </div>

        {/* Right Column: Configuration */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <h3 className="text-md font-bold mb-4 flex items-center gap-2">
              <Settings2 size={18}/> Analysis Configuration
            </h3>
            <div className="space-y-3">
              {['Manifest & Permissions Audit', 'AST JavaScript Indicator Scan', 'Obfuscation & Base64 Detection'].map(item => (
                <label key={item} className="flex items-start gap-2 text-sm bg-slate-50 p-3 rounded border">
                  <input type="checkbox" className="mt-1" defaultChecked />
                  <span className="font-medium text-slate-700">{item}</span>
                </label>
              ))}
            </div>
            <button className="w-full mt-6 bg-teal-700 text-white py-2 rounded font-medium">Start Analysis</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}