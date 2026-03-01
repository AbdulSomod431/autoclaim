import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  ShieldCheck, 
  AlertTriangle, 
  Car, 
  Wrench, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ChevronRight,
  Search,
  FileText,
  CreditCard,
  MapPin
} from 'lucide-react';
import { DamageAnalysis, PolicyInfo, PartPricing, ClaimReport } from './types';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { LogOut, User as UserIcon } from 'lucide-react';

// --- Components ---

const Header = ({ user, onLogout }: { user: any, onLogout: () => void }) => (
  <header className="border-b border-zinc-800 bg-zinc-950 p-4 flex items-center justify-between sticky top-0 z-50">
    <div className="flex items-center gap-2">
      <div className="bg-emerald-500 p-1.5 rounded">
        <ShieldCheck className="w-5 h-5 text-zinc-950" />
      </div>
      <div>
        <h1 className="text-sm font-bold tracking-tight text-white uppercase">AutoClaim-NG</h1>
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Engine v2.5.0-Flash</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      {user && (
        <div className="flex items-center gap-4 pr-4 border-r border-zinc-800">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-mono uppercase">Authenticated As</span>
            <span className="text-xs text-white font-medium">{user.email}</span>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="hidden md:flex flex-col items-end">
        <span className="text-[10px] text-zinc-500 font-mono uppercase">System Status</span>
        <span className="text-[10px] text-emerald-500 font-mono uppercase flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Operational
        </span>
      </div>
    </div>
  </header>
);

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = ['Upload', 'Analyze', 'Verify', 'Payout'];
  return (
    <div className="flex items-center justify-between px-8 py-6 bg-zinc-900/50 border-b border-zinc-800">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
            ${i <= currentStep ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-500'}
          `}>
            {i + 1}
          </div>
          <span className={`text-xs font-medium uppercase tracking-wider ${i <= currentStep ? 'text-white' : 'text-zinc-500'}`}>
            {step}
          </span>
          {i < steps.length - 1 && (
            <div className="w-12 h-px bg-zinc-800 ml-4 hidden md:block" />
          )}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DamageAnalysis | null>(null);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [disbursed, setDisbursed] = useState(false);
  const [payoutData, setPayoutData] = useState<any>(null);
  const [parts, setParts] = useState<PartPricing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Auth />;
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setStep(1);
        setDisbursed(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDisburse = async () => {
    if (!policy || !analysis) return;
    
    setIsDisbursing(true);
    setError(null);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${apiUrl}/api/disburse-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: calculateTotal(),
          plate: policy.plate_number,
          ownerName: policy.owner_name
        })
      });
      
      if (!response.ok) {
        throw new Error('Payout failed. Please try again.');
      }
      
      const data = await response.json();
      setPayoutData(data.data);
      setDisbursed(true);

      // Log claim to Supabase
      try {
        await supabase
          .from('claims')
          .insert([
            {
              plate_number: policy.plate_number,
              owner_name: policy.owner_name,
              amount: calculateTotal(),
              severity: analysis.severity,
              status: 'disbursed',
              created_at: new Date().toISOString()
            }
          ]);
      } catch (sbErr) {
        console.warn('Supabase logging failed (likely table missing):', sbErr);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDisbursing(false);
    }
  };

  const startAnalysis = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      
      // Call backend for AI analysis
      const aiRes = await fetch(`${apiUrl}/api/analyze-damage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      });

      if (!aiRes.ok) {
        const errorData = await aiRes.json();
        throw new Error(errorData.error || 'AI Analysis failed');
      }

      const result = await aiRes.json();
      setAnalysis(result);
      
      // Fetch parts pricing based on analysis
      const partsRes = await fetch(`${apiUrl}/api/parts-pricing?make=${result.vehicle_info.make}&model=${result.vehicle_info.model}&year=${result.vehicle_info.year || ''}`);
      const partsData = await partsRes.json();
      setParts(partsData);
      
      setStep(2);

      // Save assessment to Supabase
      try {
        await supabase
          .from('assessments')
          .insert([
            {
              user_id: session.user.id,
              vehicle_make: result.vehicle_info.make,
              vehicle_model: result.vehicle_info.model,
              vehicle_year: result.vehicle_info.year,
              vehicle_plate: result.vehicle_info.plate,
              damage_summary: result.damage_summary,
              severity: result.severity,
              confidence_score: result.confidence_score,
              is_consistent: result.is_consistent
            }
          ]);
      } catch (sbErr) {
        console.warn('Supabase assessment logging failed:', sbErr);
      }
    } catch (err) {
      setError('Analysis failed. Please try a clearer image.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const verifyPolicy = async (plate: string) => {
    setIsVerifying(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/verify-policy?plate=${plate}`);
      if (res.ok) {
        const data = await res.json();
        setPolicy(data);
        setStep(3);
      } else {
        setError('Policy not found in NIID database.');
      }
    } catch (err) {
      setError('Verification service unavailable.');
    } finally {
      setIsVerifying(false);
    }
  };

  const calculateTotal = () => {
    if (!parts.length) return 0;
    // Simple logic: match analysis summary with parts list
    let total = 0;
    analysis?.damage_summary.forEach(desc => {
      const match = parts.find(p => desc.toLowerCase().includes(p.part_name.toLowerCase()));
      if (match) {
        total += match.price_tokunbo + match.labor_cost;
      }
    });
    // If no specific matches, use a base estimate based on severity
    if (total === 0) {
      const base = { Minor: 50000, Moderate: 150000, Structural: 450000, Totaled: 1200000 };
      total = base[analysis?.severity || 'Minor'];
    }
    return total;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans selection:bg-emerald-500/30">
      <Header user={session?.user} onLogout={handleLogout} />
      
      <main className="max-w-6xl mx-auto pb-20">
        <StepIndicator currentStep={step} />

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30"
              >
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                  <Camera className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Upload Accident Photo</h2>
                <p className="text-zinc-500 mb-8 text-center max-w-sm">
                  Ensure the vehicle and damage are clearly visible. <br/>
                  Supported formats: JPG, PNG.
                </p>
                <label className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-8 py-3 rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/20">
                  Select Image
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </motion.div>
            )}

            {step === 1 && image && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid md:grid-cols-2 gap-8"
              >
                <div className="space-y-4">
                  <div className="aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                    <img src={image} alt="Accident" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={() => setStep(0)}
                    className="text-xs font-mono uppercase text-zinc-500 hover:text-white transition-colors"
                  >
                    ← Change Image
                  </button>
                </div>
                <div className="flex flex-col justify-center">
                  <h2 className="text-2xl font-bold text-white mb-4">Ready for Analysis</h2>
                  <p className="text-zinc-400 mb-8">
                    Our AI engine will now identify the vehicle, segment the damage, and cross-reference local market pricing.
                  </p>
                  <button 
                    onClick={startAnalysis}
                    disabled={isAnalyzing}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing Damage...
                      </>
                    ) : (
                      <>
                        Start AI Assessment
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && analysis && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid lg:grid-cols-3 gap-6"
              >
                {/* Left: Analysis Details */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Visual Intelligence Report</h3>
                      <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded">
                        Confidence: {(analysis.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-6 grid md:grid-cols-2 gap-8">
                      <div>
                        <div className="flex items-center gap-2 text-white font-bold mb-4">
                          <Car className="w-4 h-4 text-emerald-500" />
                          Vehicle Identification
                        </div>
                        <dl className="space-y-3">
                          {[
                            ['Make', analysis.vehicle_info.make],
                            ['Model', analysis.vehicle_info.model],
                            ['Year', analysis.vehicle_info.year || 'N/A'],
                            ['Plate', analysis.vehicle_info.plate || 'Not Detected'],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between border-b border-zinc-800/50 pb-2">
                              <dt className="text-xs text-zinc-500 uppercase font-mono">{label}</dt>
                              <dd className="text-sm text-white font-medium">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-white font-bold mb-4">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Damage Segmentation
                        </div>
                        <ul className="space-y-2">
                          {analysis.damage_summary.map((item, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-emerald-500 mt-1">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-6 pt-4 border-t border-zinc-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 uppercase font-mono">Severity Score</span>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${
                              analysis.severity === 'Minor' ? 'bg-emerald-500/10 text-emerald-500' :
                              analysis.severity === 'Moderate' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-red-500/10 text-red-500'
                            }`}>
                              {analysis.severity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Market Pricing */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
                      <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Ladipo Market Price Index</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-950/30 text-zinc-500 uppercase text-[10px] font-mono">
                          <tr>
                            <th className="px-6 py-3 font-medium">Part Name</th>
                            <th className="px-6 py-3 font-medium">Tokunbo (₦)</th>
                            <th className="px-6 py-3 font-medium">New (₦)</th>
                            <th className="px-6 py-3 font-medium">Labor (₦)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {parts.length > 0 ? parts.map((part) => (
                            <tr key={part.id} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-6 py-4 text-white font-medium">{part.part_name}</td>
                              <td className="px-6 py-4 font-mono">₦{part.price_tokunbo.toLocaleString()}</td>
                              <td className="px-6 py-4 font-mono">₦{part.price_new.toLocaleString()}</td>
                              <td className="px-6 py-4 font-mono">₦{part.labor_cost.toLocaleString()}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-zinc-500 italic">
                                No specific parts matched. Using general severity estimates.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right: Policy Verification */}
                <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-white font-bold mb-6">
                      <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      NIID Policy Verification
                    </div>
                    <p className="text-sm text-zinc-400 mb-6">
                      Enter the vehicle's plate number to verify insurance status before proceeding.
                    </p>
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text" 
                          placeholder="e.g. LAG-123-ABC"
                          defaultValue={analysis.vehicle_info.plate}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                          id="plate-input"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] text-zinc-500 uppercase font-mono w-full">Demo Plates:</span>
                        {['LAG-123-ABC', 'ABJ-456-XY', 'PHC-789-QW'].map(p => (
                          <button 
                            key={p}
                            onClick={() => {
                              const input = document.getElementById('plate-input') as HTMLInputElement;
                              if (input) input.value = p;
                            }}
                            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1 rounded transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-500">
                          <XCircle className="w-4 h-4" />
                          {error}
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          const val = (document.getElementById('plate-input') as HTMLInputElement).value;
                          verifyPolicy(val);
                        }}
                        disabled={isVerifying}
                        className="w-full bg-white hover:bg-zinc-200 text-zinc-950 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify with NIID'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
                    <h4 className="text-xs font-mono uppercase tracking-widest text-emerald-500 mb-2">Estimated Payout</h4>
                    <div className="text-4xl font-bold text-white mb-1">
                      ₦{calculateTotal().toLocaleString()}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase">Includes Parts & Labor (Tokunbo Rate)</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && policy && analysis && (
              <motion.div 
                key="payout"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl shadow-emerald-500/10">
                  <div className="bg-emerald-500 p-8 text-zinc-950 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter">Claim Verified</h2>
                      <p className="text-sm font-medium opacity-80">Instant Payout Voucher Generated</p>
                    </div>
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  
                  <div className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Policy Holder</span>
                        <span className="text-white font-bold">{policy.owner_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Insurer</span>
                        <span className="text-white font-bold">{policy.insurance_company}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Vehicle</span>
                        <span className="text-white font-bold">{analysis.vehicle_info.make} {analysis.vehicle_info.model}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">Plate Number</span>
                        <span className="text-white font-bold">{policy.plate_number}</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800 pt-8">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-zinc-400">Total Repair Estimate</span>
                        <span className="text-2xl font-bold text-white">₦{calculateTotal().toLocaleString()}</span>
                      </div>
                      <div className="bg-zinc-950 rounded-2xl p-4 flex items-center gap-4 border border-zinc-800">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase font-mono">Payout Method</p>
                          <p className="text-sm text-white font-medium">Direct BVN Linked Account</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-500">
                          <XCircle className="w-4 h-4" />
                          {error}
                        </div>
                      )}
                      {!disbursed ? (
                        <button 
                          onClick={handleDisburse}
                          disabled={isDisbursing}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-zinc-950 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                          {isDisbursing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Disbursing Funds...
                            </>
                          ) : (
                            'Accept & Disburse Funds'
                          )}
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3 text-emerald-500">
                            <CheckCircle2 className="w-6 h-6 shrink-0" />
                            <div>
                              <p className="font-bold">Transfer Successful</p>
                              <p className="text-xs opacity-80">Funds have been sent to your linked account.</p>
                            </div>
                          </div>
                          {payoutData && (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                              <div className="flex justify-between text-[10px] font-mono uppercase">
                                <span className="text-zinc-500">Transaction ID</span>
                                <span className="text-white">{payoutData.transactionId}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-mono uppercase">
                                <span className="text-zinc-500">Reference</span>
                                <span className="text-white">{payoutData.reference}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-mono uppercase">
                                <span className="text-zinc-500">Timestamp</span>
                                <span className="text-white">{new Date(payoutData.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          setStep(0);
                          setDisbursed(false);
                        }}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-bold transition-all"
                      >
                        {disbursed ? 'Start New Claim' : 'Cancel Claim'}
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-center text-zinc-600 font-mono uppercase">
                      Voucher ID: AC-{Math.random().toString(36).substr(2, 9).toUpperCase()} • Generated {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-0 w-full bg-zinc-950/80 backdrop-blur border-t border-zinc-800 p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] font-mono uppercase text-zinc-600">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Lagos, NG</span>
            <span>Ladipo Index: Updated 2h ago</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_SUPABASE_URL ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
              Supabase: {import.meta.env.VITE_SUPABASE_URL ? 'Connected' : 'Offline'}
            </span>
            <span>NIID API: Connected</span>
            <span>Gemini 2.5 Flash: Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
