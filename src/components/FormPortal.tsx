import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, FileCode, CheckCircle2, AlertCircle, Building2, Globe, Mail, User, Shield, Video, ArrowRight, RefreshCw } from 'lucide-react';
import { ApplicationFormData } from '../types';
import { dbService } from '../services/dbService';

export default function FormPortal() {
  const [formData, setFormData] = useState<ApplicationFormData>({
    company_name: '',
    website: '',
    one_line_pitch: '',
    description: '',
    hq_location: '',
    sector: 'SaaS',
    founder_name: '',
    founder_email: '',
    founder_linkedin: '',
    team_size: 1,
    team_background: '',
    stage: 'Ideation',
    funding_raised: 0,
    target_raise: 100000,
    traction: '',
    demo_video: '',
    pitch_deck: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedId, setSubmittedId] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sectors = [
    'SaaS',
    'AI/ML',
    'FinTech',
    'HealthTech',
    'CleanTech',
    'DeepTech',
    'Web3',
    'Consumer',
    'B2B Enterprise',
    'Other',
  ];

  const stages = [
    'Ideation',
    'MVP/Pre-revenue',
    'Post-revenue/Traction',
    'Scaling',
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'team_size' || name === 'funding_raised' || name === 'target_raise'
        ? Number(value)
        : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrs = { ...prev };
        delete newErrs[name];
        return newErrs;
      });
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'ppt' && extension !== 'pptx') {
      setErrors((prev) => ({
        ...prev,
        pitch_deck: 'Pitch deck must be a PDF, PPT, or PPTX presentation file.',
      }));
      return;
    }

    // Limit file size to 50MB
    if (file.size > 50 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        pitch_deck: 'Pitch deck file must be smaller than 50MB.',
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, pitch_deck: file }));
    setErrors((prev) => {
      const newErrs = { ...prev };
      delete newErrs['pitch_deck'];
      return newErrs;
    });
  };

  // Drag and Drop handlers
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
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) newErrors.company_name = 'Company Name is required.';
    
    // Website validation
    if (!formData.website.trim()) {
      newErrors.website = 'Website URL is required.';
    } else {
      try {
        let url = formData.website.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        new URL(url);
      } catch (e) {
        newErrors.website = 'Enter a valid URL (e.g. acme.com).';
      }
    }

    if (!formData.one_line_pitch.trim()) {
      newErrors.one_line_pitch = 'A one-line pitch is required.';
    } else if (formData.one_line_pitch.length > 150) {
      newErrors.one_line_pitch = 'One-line pitch must be 150 characters or less.';
    }

    if (!formData.description.trim()) newErrors.description = 'Company description is required.';
    if (!formData.hq_location.trim()) newErrors.hq_location = 'Headquarters location is required.';
    if (!formData.founder_name.trim()) newErrors.founder_name = 'Founder name is required.';
    
    // Email validation
    if (!formData.founder_email.trim()) {
      newErrors.founder_email = 'Founder email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.founder_email.trim())) {
      newErrors.founder_email = 'Enter a valid email address.';
    }

    // LinkedIn validation
    if (!formData.founder_linkedin.trim()) {
      newErrors.founder_linkedin = 'Founder LinkedIn profile is required.';
    } else if (!formData.founder_linkedin.includes('linkedin.com/')) {
      newErrors.founder_linkedin = 'Enter a valid LinkedIn URL.';
    }

    if (formData.team_size <= 0) newErrors.team_size = 'Team size must be 1 or more.';
    if (!formData.team_background.trim()) newErrors.team_background = 'Team backgrounds are required.';
    if (formData.target_raise <= 0) newErrors.target_raise = 'Target raise must be greater than 0.';
    if (!formData.traction.trim()) newErrors.traction = 'Traction details are required.';

    if (!formData.pitch_deck) {
      newErrors.pitch_deck = 'Please upload your pitch deck (PDF or PPT).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const element = document.getElementById(firstErrorKey);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await dbService.submitApplication(formData);
      if (response.success && response.id) {
        setSubmittedId(response.id);
        setIsSuccess(true);
      } else {
        setSubmitError(response.error || 'Failed to submit application. Please verify details and try again.');
      }
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || 'An unexpected connection error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      company_name: '',
      website: '',
      one_line_pitch: '',
      description: '',
      hq_location: '',
      sector: 'SaaS',
      founder_name: '',
      founder_email: '',
      founder_linkedin: '',
      team_size: 1,
      team_background: '',
      stage: 'Ideation',
      funding_raised: 0,
      target_raise: 100000,
      traction: '',
      demo_video: '',
      pitch_deck: null,
    });
    setErrors({});
    setIsSuccess(false);
    setSubmitError('');
    setSubmittedId('');
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-12" id="success-view">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-xl bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-50 border border-neutral-200 mb-6">
            <CheckCircle2 className="h-7 w-7 text-neutral-800" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
            Application Submitted
          </h1>
          <p className="text-neutral-500 text-sm max-w-md mx-auto mb-8">
            Thank you for applying to Middha Ventures. Your application for <span className="font-medium text-neutral-800">{formData.company_name}</span> has been securely stored in our CRM. Our investment team will review your pitch deck shortly.
          </p>

          <div className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-5 mb-8 text-left text-xs text-neutral-600 space-y-3 font-mono">
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>APPLICATION ID:</span>
              <span className="font-semibold text-neutral-900">{submittedId}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>COMPANY:</span>
              <span className="font-semibold text-neutral-900">{formData.company_name}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>SECTOR:</span>
              <span className="font-semibold text-neutral-900">{formData.sector}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-200/50 pb-2">
              <span>TARGET RAISE:</span>
              <span className="font-semibold text-neutral-900">${formData.target_raise.toLocaleString()} USD</span>
            </div>
            <div className="flex justify-between">
              <span>SUBMISSION TIMESTAMP:</span>
              <span className="font-semibold text-neutral-900">{new Date().toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 shadow-sm"
              id="btn-apply-another"
            >
              Apply for Another Company
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12" id="application-form-view">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          Middha Ventures Startup Intake
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Intelligent, stage-agnostic venture capital for early-stage enterprise technology builders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Submission Failed</p>
              <p className="opacity-90">{submitError}</p>
            </div>
          </div>
        )}

        {/* Section 1: Company Profile */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">Company Profile</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5" id="company_name_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="company_name">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                placeholder="Acme Systems"
                value={formData.company_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.company_name ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.company_name && <span className="text-xs text-red-500">{errors.company_name}</span>}
            </div>

            <div className="space-y-1.5" id="website_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="website">
                Website URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="website"
                name="website"
                placeholder="acmesystems.com"
                value={formData.website}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.website ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.website && <span className="text-xs text-red-500">{errors.website}</span>}
            </div>

            <div className="space-y-1.5 md:col-span-2" id="one_line_pitch_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="one_line_pitch">
                One-Line Pitch <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="one_line_pitch"
                name="one_line_pitch"
                maxLength={150}
                placeholder="Generative LLM agents for automated medical billing compliance."
                value={formData.one_line_pitch}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.one_line_pitch ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>Summarize your business model and product in 1 sentence.</span>
                <span>{formData.one_line_pitch.length}/150 characters</span>
              </div>
              {errors.one_line_pitch && <span className="text-xs text-red-500">{errors.one_line_pitch}</span>}
            </div>

            <div className="space-y-1.5 md:col-span-2" id="description_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="description">
                Company Deep-Dive <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                placeholder="Describe your product in detail. What are you building? What is your technological defensibility? What specific pain points do you solve for your customers?"
                value={formData.description}
                onChange={handleInputChange}
                className={`w-full px-3 py-2.5 text-sm bg-neutral-50 border ${errors.description ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.description && <span className="text-xs text-red-500">{errors.description}</span>}
            </div>

            <div className="space-y-1.5" id="sector_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="sector">
                Industry Sector <span className="text-red-500">*</span>
              </label>
              <select
                id="sector"
                name="sector"
                value={formData.sector}
                onChange={handleInputChange}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none cursor-pointer"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5" id="hq_location_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="hq_location">
                Headquarters / Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="hq_location"
                name="hq_location"
                placeholder="San Francisco, CA or Remote"
                value={formData.hq_location}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.hq_location ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.hq_location && <span className="text-xs text-red-500">{errors.hq_location}</span>}
            </div>
          </div>
        </div>

        {/* Section 2: Team Profiles */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <User className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">Founding Team</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5" id="founder_name_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_name">
                Primary Contact / Founder Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="founder_name"
                name="founder_name"
                placeholder="Sarah Jenkins"
                value={formData.founder_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_name ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.founder_name && <span className="text-xs text-red-500">{errors.founder_name}</span>}
            </div>

            <div className="space-y-1.5" id="founder_email_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_email">
                Primary Contact Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="founder_email"
                name="founder_email"
                placeholder="sarah@acmesystems.com"
                value={formData.founder_email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_email ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.founder_email && <span className="text-xs text-red-500">{errors.founder_email}</span>}
            </div>

            <div className="space-y-1.5" id="founder_linkedin_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="founder_linkedin">
                Founder LinkedIn Profile URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="founder_linkedin"
                name="founder_linkedin"
                placeholder="https://linkedin.com/in/sarahjenkins"
                value={formData.founder_linkedin}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.founder_linkedin ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.founder_linkedin && <span className="text-xs text-red-500">{errors.founder_linkedin}</span>}
            </div>

            <div className="space-y-1.5" id="team_size_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="team_size">
                Total Full-time Team Size <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="team_size"
                name="team_size"
                min={1}
                max={500}
                value={formData.team_size}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.team_size ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.team_size && <span className="text-xs text-red-500">{errors.team_size}</span>}
            </div>

            <div className="space-y-1.5 md:col-span-2" id="team_background_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="team_background">
                Team & Co-Founder Backgrounds <span className="text-red-500">*</span>
              </label>
              <textarea
                id="team_background"
                name="team_background"
                rows={3}
                placeholder="Briefly state who the co-founders are, their prior working relationship, key technical accomplishments, and relevant employment pedigree."
                value={formData.team_background}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.team_background ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.team_background && <span className="text-xs text-red-500">{errors.team_background}</span>}
            </div>
          </div>
        </div>

        {/* Section 3: Financials & Traction */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Globe className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">Traction & Funding Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5" id="stage_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="stage">
                Company Stage <span className="text-red-500">*</span>
              </label>
              <select
                id="stage"
                name="stage"
                value={formData.stage}
                onChange={handleInputChange}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none cursor-pointer"
              >
                {stages.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5" id="funding_raised_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="funding_raised">
                Prior Capital Raised ($ USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="funding_raised"
                name="funding_raised"
                min={0}
                placeholder="150000"
                value={formData.funding_raised}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.funding_raised ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              <span className="text-[10px] text-neutral-400">Put '0' if bootstrapped.</span>
              {errors.funding_raised && <span className="text-xs text-red-500">{errors.funding_raised}</span>}
            </div>

            <div className="space-y-1.5" id="target_raise_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="target_raise">
                Target Raise Amount ($ USD) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="target_raise"
                name="target_raise"
                min={1}
                placeholder="1500000"
                value={formData.target_raise}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.target_raise ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none`}
              />
              {errors.target_raise && <span className="text-xs text-red-500">{errors.target_raise}</span>}
            </div>

            <div className="space-y-1.5" id="demo_video_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="demo_video">
                Product Demo Link <span className="text-neutral-400">(Optional)</span>
              </label>
              <input
                type="text"
                id="demo_video"
                name="demo_video"
                placeholder="https://loom.com/..."
                value={formData.demo_video}
                onChange={handleInputChange}
                className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2" id="traction_field">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500" htmlFor="traction">
                Describe Traction & Customer Metrics <span className="text-red-500">*</span>
              </label>
              <textarea
                id="traction"
                name="traction"
                rows={3}
                placeholder="Quantify your current traction (MRR, pilot partnerships, active users, engagement metrics, LOIs signed, customer satisfaction, or biological validations)."
                value={formData.traction}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 text-sm bg-neutral-50 border ${errors.traction ? 'border-red-300 focus:border-red-400' : 'border-neutral-200 focus:border-neutral-900'} focus:bg-white rounded-lg transition-colors outline-none resize-none`}
              />
              {errors.traction && <span className="text-xs text-red-500">{errors.traction}</span>}
            </div>
          </div>
        </div>

        {/* Section 4: Pitch Deck Material Upload */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Upload className="h-5 w-5 text-neutral-500" />
            <h2 className="text-lg font-medium text-neutral-900">Pitch Deck</h2>
          </div>

          <div className="space-y-3">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-neutral-900 bg-neutral-50'
                  : formData.pitch_deck
                  ? 'border-neutral-300 bg-neutral-50/50 hover:bg-neutral-50'
                  : 'border-neutral-200 hover:border-neutral-400 bg-transparent'
              }`}
              id="pitch_deck_zone"
            >
              <input
                type="file"
                ref={fileInputRef}
                id="pitch_deck"
                accept=".pdf,.ppt,.pptx"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
              />

              {formData.pitch_deck ? (
                <div className="space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
                    <FileCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {formData.pitch_deck.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {(formData.pitch_deck.size / (1024 * 1024)).toFixed(2)} MB • Ready to Upload
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((prev) => ({ ...prev, pitch_deck: null }));
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 font-medium underline"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200/55">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      Drag & Drop Pitch Deck File
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Support PDF, PPT, PPTX formats. Max 50MB.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-md font-medium text-neutral-700 hover:bg-neutral-200 transition-colors">
                    Browse Files
                  </span>
                </div>
              )}
            </div>

            {errors.pitch_deck && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                {errors.pitch_deck}
              </p>
            )}
          </div>
        </div>

        {/* Form Submission Button */}
        <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Shield className="h-3.5 w-3.5" />
            <span>Applications are securely stored with end-to-end RLS.</span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            id="btn-submit-application"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Submitting Application...
              </>
            ) : (
              <>
                Submit Application
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
