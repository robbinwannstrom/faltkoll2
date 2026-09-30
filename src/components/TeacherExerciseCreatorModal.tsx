import React, { useState, useEffect } from 'react';
import {
  TeacherExercise,
  MomentDefinition,
  ProjectType,
  UserAccount,
  ExerciseLink,
} from '../types';
import { ALL_MOMENTS, PROJECT_TYPE_LABELS } from '../data/momentsData';
import {
  saveTeacherExercise,
  fetchTeacherExercises,
  deleteTeacherExercise,
} from '../services/exerciseService';
import { STANDARD_STUDENT_GROUPS } from '../services/userService';
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  FileText,
  Camera,
  CheckCircle2,
  ExternalLink,
  Layers,
  Ruler,
  AlertTriangle,
  Play,
  ArrowLeft,
  Sparkles,
  Users,
  Search,
  Filter,
} from 'lucide-react';

interface TeacherExerciseCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onStartExerciseProject?: (exercise: TeacherExercise) => void;
}

type CreatorMode = 'LIST' | 'CHOOSE_CREATION_TYPE' | 'TEMPLATE_FORM' | 'SCRATCH_FORM';

export const TeacherExerciseCreatorModal: React.FC<TeacherExerciseCreatorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStartExerciseProject,
}) => {
  const [exercises, setExercises] = useState<TeacherExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CreatorMode>('LIST');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form state for creating / editing exercise
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('HUSGRUND');
  const [targetGroup, setTargetGroup] = useState('Byggprogrammet (BA)');
  const [difficulty, setDifficulty] = useState<'GRUNDLÄGGANDE' | 'MEDEL' | 'AVANCERAD'>('MEDEL');
  const [instructions, setInstructions] = useState('');
  const [sideA, setSideA] = useState<number | undefined>(10.0);
  const [sideB, setSideB] = useState<number | undefined>(8.0);
  const [fallCmPerM, setFallCmPerM] = useState<number | undefined>(1.0);
  const [links, setLinks] = useState<ExerciseLink[]>([]);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Selected moments & customized moments for the exercise
  const [activeMoments, setActiveMoments] = useState<MomentDefinition[]>([]);
  const [expandedMomentId, setExpandedMomentId] = useState<string | null>(null);
  const [expandedPhaseNum, setExpandedPhaseNum] = useState<number | null>(1);

  // New moment in phase helper state
  const [addingToPhaseNum, setAddingToPhaseNum] = useState<number | null>(null);
  const [newMomentTitle, setNewMomentTitle] = useState('');
  const [newMomentAma, setNewMomentAma] = useState('');
  const [newMomentInstruction, setNewMomentInstruction] = useState('');
  const [newMomentRequirePhoto, setNewMomentRequirePhoto] = useState(true);

  // New phase state for scratch mode
  const [newPhaseName, setNewPhaseName] = useState('');

  const loadAllExercises = async () => {
    setLoading(true);
    try {
      const list = await fetchTeacherExercises();
      setExercises(list);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllExercises();
      setMode('LIST');
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const copyCodeToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedCode(text);
      showToast(`Övningskod "${text}" har kopierats till urklipp!`);
      setTimeout(() => setCopiedCode(null), 3000);
    } catch {}
  };

  // Start creating from scratch
  const handleStartScratch = () => {
    setEditingExerciseId(null);
    setTitle('');
    setCode(`ÖVN-${Math.floor(100 + Math.random() * 900)}`);
    setDescription('');
    setProjectType('HUSGRUND');
    setTargetGroup('Byggprogrammet (BA)');
    setDifficulty('MEDEL');
    setInstructions('');
    setSideA(undefined);
    setSideB(undefined);
    setFallCmPerM(undefined);
    setLinks([]);
    setActiveMoments([]);
    setMode('SCRATCH_FORM');
  };

  // Start creating from template
  const handleStartTemplate = (type: ProjectType) => {
    setEditingExerciseId(null);
    const info = PROJECT_TYPE_LABELS[type];
    setTitle(`Övning: ${info.title} (${currentUser?.displayName || 'Klass'})`);
    setCode(`${type.substring(0, 4)}-${Math.floor(10 + Math.random() * 90)}`);
    setDescription(`Praktisk fältövning i ${info.title.toLowerCase()}. Följ instruktioner och kontrollkrav.`);
    setProjectType(type);
    setTargetGroup('Byggprogrammet (BA)');
    setDifficulty('MEDEL');
    setInstructions('Utför momenten i fasordning. Kontrollera mått med laser och fota utförda kontrollmoment.');
    
    if (type === 'HUSGRUND') {
      setSideA(10.0);
      setSideB(8.0);
      setFallCmPerM(1.0);
    } else if (type === 'PLATTSATTNING') {
      setSideA(6.0);
      setSideB(4.0);
      setFallCmPerM(2.0);
    } else {
      setSideA(undefined);
      setSideB(undefined);
      setFallCmPerM(undefined);
    }

    setLinks([]);
    // Clone default moments for this project type
    const templateMoments = ALL_MOMENTS.filter((m) => m.projectType === type).map((m) => ({
      ...m,
    }));
    setActiveMoments(templateMoments);
    setMode('TEMPLATE_FORM');
  };

  // Start editing existing exercise
  const handleEditExercise = (ex: TeacherExercise) => {
    setEditingExerciseId(ex.id);
    setTitle(ex.title);
    setCode(ex.code);
    setDescription(ex.description || '');
    setProjectType(ex.projectType || 'HUSGRUND');
    setTargetGroup(ex.targetGroup || 'Alla grupper');
    setDifficulty(ex.difficulty || 'MEDEL');
    setInstructions(ex.instructions || '');
    setSideA(ex.fieldMeasurements?.sideA);
    setSideB(ex.fieldMeasurements?.sideB);
    setFallCmPerM(ex.fieldMeasurements?.fallCmPerM);
    setLinks(ex.links || []);
    setActiveMoments(
      ex.customMoments && ex.customMoments.length > 0
        ? ex.customMoments.map((m) => ({ ...m }))
        : ALL_MOMENTS.filter((m) => m.projectType === ex.projectType).map((m) => ({ ...m }))
    );
    setMode('TEMPLATE_FORM');
  };

  // Toggle a moment on/off in the active exercise
  const handleToggleMoment = (momentId: string, templateMoment: MomentDefinition) => {
    const exists = activeMoments.some((m) => m.id === momentId);
    if (exists) {
      if (activeMoments.length <= 1) {
        alert('En övning måste innehålla minst ett moment.');
        return;
      }
      setActiveMoments((prev) => prev.filter((m) => m.id !== momentId));
    } else {
      setActiveMoments((prev) => [...prev, { ...templateMoment }]);
    }
  };

  // Toggle an entire phase on/off
  const handleTogglePhase = (phaseNum: number, phaseMoments: MomentDefinition[]) => {
    const phaseMomentIds = phaseMoments.map((m) => m.id);
    const hasAny = activeMoments.some((m) => phaseMomentIds.includes(m.id));

    if (hasAny) {
      // Remove all moments in phase
      setActiveMoments((prev) => prev.filter((m) => !phaseMomentIds.includes(m.id)));
    } else {
      // Add all moments in phase
      setActiveMoments((prev) => [...prev, ...phaseMoments.map((m) => ({ ...m }))]);
    }
  };

  // Update specific property on a moment
  const handleUpdateMomentProperty = (
    momentId: string,
    key: keyof MomentDefinition,
    value: any
  ) => {
    setActiveMoments((prev) =>
      prev.map((m) => (m.id === momentId ? { ...m, [key]: value } : m))
    );
  };

  // Add custom moment to phase
  const handleAddMomentToPhase = (phaseNum: number, phaseName: string) => {
    if (!newMomentTitle.trim()) {
      alert('Vänligen ange momentets rubrik.');
      return;
    }

    const currentPhaseMoments = activeMoments.filter((m) => m.phaseNumber === phaseNum);
    const nextSubOrder = currentPhaseMoments.length + 1;
    const newId = `${phaseNum}.${nextSubOrder}_custom_${Date.now().toString(36).substring(2, 5)}`;

    const newMoment: MomentDefinition = {
      id: newId,
      projectType,
      order: activeMoments.length + 1,
      phaseNumber: phaseNum,
      phaseName,
      title: newMomentTitle.trim(),
      amaCode: newMomentAma.trim() || 'AMA-EGEN',
      instruction: newMomentInstruction.trim() || 'Utför kontroll enligt lärarens anvisning.',
      studentTip: 'Rådfråga handledare eller lärare vid minsta mättveksamhet.',
      proTip: 'Kontrollera toleranser noga innan signering.',
      criticalValidationHint: newMomentRequirePhoto ? 'Obligatoriskt fotobevis krävs för godkänt.' : undefined,
    };

    setActiveMoments((prev) => [...prev, newMoment]);
    setAddingToPhaseNum(null);
    setNewMomentTitle('');
    setNewMomentAma('');
    setNewMomentInstruction('');
    setNewMomentRequirePhoto(true);
  };

  // Add a brand new phase in Scratch Mode
  const handleAddNewPhase = () => {
    if (!newPhaseName.trim()) {
      alert('Vänligen ange ett namn på fasen (t.ex. "Fas 1: Utsättning").');
      return;
    }

    const existingPhaseNums = Array.from(new Set(activeMoments.map((m) => m.phaseNumber)));
    const nextPhaseNum = existingPhaseNums.length > 0 ? Math.max(...existingPhaseNums) + 1 : 1;
    const phaseFullName = `FAS ${nextPhaseNum}: ${newPhaseName.trim().replace(/^fas \d+:?\s*/i, '')}`;

    const initialMoment: MomentDefinition = {
      id: `${nextPhaseNum}.1_custom_${Date.now().toString(36).substring(2, 5)}`,
      projectType,
      order: activeMoments.length + 1,
      phaseNumber: nextPhaseNum,
      phaseName: phaseFullName,
      title: `Moment 1 i ${newPhaseName.trim()}`,
      amaCode: 'AMA Anläggning',
      instruction: 'Följ handledarens anvisningar för detta moment.',
      studentTip: 'Mät två gånger innan du utför momentet.',
      proTip: 'Dokumentera med tydliga foton.',
    };

    setActiveMoments((prev) => [...prev, initialMoment]);
    setNewPhaseName('');
    setExpandedPhaseNum(nextPhaseNum);
  };

  // Delete a moment
  const handleDeleteMoment = (momentId: string) => {
    if (activeMoments.length <= 1) {
      alert('En övning måste innehålla minst ett moment.');
      return;
    }
    setActiveMoments((prev) => prev.filter((m) => m.id !== momentId));
  };

  // Add external link / drawing
  const handleAddLink = () => {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    setLinks((prev) => [
      ...prev,
      {
        id: `link_${Date.now()}`,
        title: newLinkTitle.trim(),
        url: newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`,
        category: 'RITNING',
      },
    ]);
    setNewLinkTitle('');
    setNewLinkUrl('');
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  };

  // Save exercise to Cloud & local
  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vänligen ange en titel för övningen.');
      return;
    }
    if (!code.trim()) {
      alert('Vänligen ange en unik övningskod.');
      return;
    }
    if (activeMoments.length === 0) {
      alert('Vänligen inkludera minst ett moment i övningen.');
      return;
    }

    let calculatedDiagonal: number | undefined = undefined;
    if (sideA && sideB && sideA > 0 && sideB > 0) {
      calculatedDiagonal = Number(Math.sqrt(sideA * sideA + sideB * sideB).toFixed(2));
    }

    const cleanExercise: TeacherExercise = {
      id: editingExerciseId || `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      projectType,
      targetGroup: targetGroup.trim(),
      difficulty,
      instructions: instructions.trim(),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      createdByTeacherName: currentUser?.displayName || 'Yrkeslärare',
      createdByTeacherId: currentUser?.id || 'usr_teacher',
      links,
      customMoments: activeMoments,
      fieldMeasurements: {
        sideA,
        sideB,
        diagonal: calculatedDiagonal,
        fallCmPerM,
      },
    };

    setLoading(true);
    try {
      await saveTeacherExercise(cleanExercise);
      await loadAllExercises();
      setMode('LIST');
      showToast(`Övning "${cleanExercise.title}" (${cleanExercise.code}) har sparats online i molnet!`);
    } catch (err: any) {
      alert('Kunde inte spara övning: ' + (err.message || 'Okänt fel'));
    } finally {
      setLoading(false);
    }
  };

  // Delete exercise
  const handleDeleteExercise = async (ex: TeacherExercise) => {
    if (!confirm(`Är du säker på att du vill ta bort övningen "${ex.title}" (${ex.code})?`)) return;
    setLoading(true);
    try {
      await deleteTeacherExercise(ex.id, ex.code);
      setExercises((prev) => prev.filter((item) => item.id !== ex.id && item.code !== ex.code));
      showToast(`Övning "${ex.title}" togs bort.`);
    } catch {
      alert('Kunde inte ta bort övningen.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter exercises in list
  const filteredExercises = exercises.filter((ex) => {
    const matchesGroup =
      selectedGroupFilter === 'ALL' ||
      !ex.targetGroup ||
      ex.targetGroup === 'Alla grupper' ||
      ex.targetGroup.toLowerCase().includes(selectedGroupFilter.toLowerCase());
    const matchesQuery =
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGroup && matchesQuery;
  });

  // Group active moments by phase for accordion rendering
  const phasesMap: Record<number, { name: string; moments: MomentDefinition[] }> = {};
  
  // In template mode, also show available unselected template moments
  const sourceMoments = mode === 'TEMPLATE_FORM'
    ? ALL_MOMENTS.filter((m) => m.projectType === projectType)
    : activeMoments;

  sourceMoments.forEach((m) => {
    if (!phasesMap[m.phaseNumber]) {
      phasesMap[m.phaseNumber] = { name: m.phaseName, moments: [] };
    }
    // Check if moment is already added or distinct
    if (!phasesMap[m.phaseNumber].moments.some((x) => x.id === m.id)) {
      phasesMap[m.phaseNumber].moments.push(m);
    }
  });

  // Also include any custom moments created by user in that phase
  activeMoments.forEach((m) => {
    if (!phasesMap[m.phaseNumber]) {
      phasesMap[m.phaseNumber] = { name: m.phaseName, moments: [] };
    }
    if (!phasesMap[m.phaseNumber].moments.some((x) => x.id === m.id)) {
      phasesMap[m.phaseNumber].moments.push(m);
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-[#141414] border border-[#2b2b2b] rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 sm:p-6 border-b border-[#242424] flex items-center justify-between shrink-0 bg-[#171717]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Kreatörspanel för Övningar
                </h2>
                <span className="text-[10px] bg-orange-950 text-orange-300 font-bold px-2 py-0.5 rounded-full border border-orange-800">
                  Lärarverktyg
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Skapa, anpassa och tilldela praktiska fältövningar till elever och grupper.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#222222] hover:bg-[#2e2e2e] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toastMsg && (
          <div className="bg-amber-950/90 border-b border-amber-500/60 p-3 px-6 text-xs text-amber-200 font-bold flex items-center justify-between animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button
              onClick={() => setToastMsg(null)}
              className="text-amber-400 hover:text-white text-xs underline cursor-pointer"
            >
              Stäng
            </button>
          </div>
        )}

        {/* ================= MODAL CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ================= 1. LIST VIEW ================= */}
          {mode === 'LIST' && (
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Sök bland övningar eller koder..."
                      className="w-full min-h-[42px] px-3.5 pl-9 bg-[#1a1a1a] border border-[#2e2e2e] focus:border-orange-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>

                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="min-h-[42px] px-3 bg-[#1a1a1a] border border-[#2e2e2e] focus:border-orange-500 rounded-xl text-xs text-slate-300 font-semibold outline-none cursor-pointer"
                  >
                    <option value="ALL">Alla grupper / klasser</option>
                    {STANDARD_STUDENT_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setMode('CHOOSE_CREATION_TYPE')}
                  className="min-h-[44px] px-4 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Skapa ny övning</span>
                </button>
              </div>

              {/* Exercise Cards */}
              {loading ? (
                <div className="p-12 text-center text-slate-400 text-xs font-bold">
                  Laddar övningar från molnet...
                </div>
              ) : filteredExercises.length === 0 ? (
                <div className="p-10 border-2 border-dashed border-[#292929] rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#202020] text-slate-400 flex items-center justify-center mx-auto text-xl">
                    📚
                  </div>
                  <p className="text-sm font-bold text-white">Inga övningar hittades</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Klicka på "Skapa ny övning" för att bygga en mall för dina elever eller anpassa befintliga projekt.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExercises.map((ex) => {
                    const typeInfo = PROJECT_TYPE_LABELS[ex.projectType] || {
                      icon: '🏗️',
                      title: ex.projectType,
                    };
                    const momentCount = ex.customMoments?.length || 0;

                    return (
                      <div
                        key={ex.id}
                        className="bg-[#1c1c1c] border border-[#2d2d2d] hover:border-orange-500/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all shadow-md group"
                      >
                        <div className="space-y-2.5">
                          {/* Badges */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black font-mono bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <span>Kod: {ex.code}</span>
                              <button
                                type="button"
                                onClick={() => copyCodeToClipboard(ex.code)}
                                className="hover:text-white cursor-pointer ml-1"
                                title="Kopiera kod"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </span>

                            <span className="text-[10px] font-bold bg-[#141414] text-slate-300 border border-[#333333] px-2 py-0.5 rounded-md">
                              {ex.targetGroup || 'Alla elever'}
                            </span>
                          </div>

                          {/* Title & Desc */}
                          <div>
                            <h3 className="text-sm font-black text-white group-hover:text-orange-300 transition-colors line-clamp-1">
                              {ex.title}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                              {ex.description || 'Ingen ytterligare beskrivning.'}
                            </p>
                          </div>

                          {/* Stats Tags */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                            <span className="bg-[#121212] px-2 py-0.5 rounded-md border border-[#2a2a2a] flex items-center gap-1">
                              <span>{typeInfo.icon}</span>
                              <span>{typeInfo.title}</span>
                            </span>
                            <span className="bg-[#121212] px-2 py-0.5 rounded-md border border-[#2a2a2a] flex items-center gap-1 font-bold text-slate-300">
                              <Layers className="w-3 h-3 text-orange-400" />
                              <span>{momentCount} moment</span>
                            </span>
                            {ex.fieldMeasurements?.diagonal && (
                              <span className="bg-[#121212] px-2 py-0.5 rounded-md border border-[#2a2a2a] flex items-center gap-1 font-mono text-emerald-300">
                                <Ruler className="w-3 h-3 text-emerald-400" />
                                <span>Kryssmått: {ex.fieldMeasurements.diagonal}m</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-[#262626] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditExercise(ex)}
                              className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333333] text-slate-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3 h-3 text-orange-400" />
                              <span>Redigera</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteExercise(ex)}
                              className="p-1.5 bg-[#252525] hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg text-xs cursor-pointer transition-colors"
                              title="Ta bort övning"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {onStartExerciseProject && (
                            <button
                              type="button"
                              onClick={() => {
                                onStartExerciseProject(ex);
                                onClose();
                              }}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-orange-500/20 transition-all"
                            >
                              <Play className="w-3 h-3 stroke-[2.5]" />
                              <span>Starta som övning</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= 2. CHOOSE CREATION TYPE ================= */}
          {mode === 'CHOOSE_CREATION_TYPE' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="flex items-center justify-between border-b border-[#252525] pb-3">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Tillbaka till övningslistan</span>
                </button>
                <span className="text-xs font-bold text-orange-400">Steg 1: Välj metod</span>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-black text-white">Hur vill du skapa övningen?</h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Välj att utgå från en beprövad AMA-mall med färdiga faser och moment, eller bygg helt från grunden.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option A: From Template */}
                <div className="bg-[#1c1c1c] border-2 border-[#2f2f2f] hover:border-orange-500/60 rounded-3xl p-6 flex flex-col justify-between gap-4 transition-all">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center justify-center text-2xl font-bold">
                      📐
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">Utgå från mall</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Välj en av appens färdiga branschövningar. Du får välja exakt vilka faser och moment som ska vara med, sätta toleranser och krav på bilder.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[#262626]">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Välj grundtyp:
                    </div>
                    {(['HUSGRUND', 'PLATTSATTNING', 'ALTAN_TRADACK', 'ENSKILT_AVLOPP'] as ProjectType[]).map(
                      (type) => {
                        const info = PROJECT_TYPE_LABELS[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleStartTemplate(type)}
                            className="w-full p-2.5 rounded-xl bg-[#141414] hover:bg-orange-500/15 border border-[#2b2b2b] hover:border-orange-500/40 text-left flex items-center justify-between cursor-pointer transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{info.icon}</span>
                              <span className="text-xs font-bold text-white group-hover:text-orange-300">
                                {info.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {info.count} moment
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Option B: From Scratch */}
                <div className="bg-[#1c1c1c] border-2 border-[#2f2f2f] hover:border-orange-500/60 rounded-3xl p-6 flex flex-col justify-between gap-4 transition-all">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center text-2xl font-bold">
                      ✏️
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">Skapa helt från scratch</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Designa en helt skräddarsydd övning från ett blankt papper. Lägg till egna faser, moment, instruktioner, kontrollpunkter och mått.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#262626]">
                    <button
                      type="button"
                      onClick={handleStartScratch}
                      className="w-full min-h-[48px] bg-[#141414] hover:bg-sky-500/20 border border-[#2e2e2e] hover:border-sky-500 text-sky-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Starta tom övning från grunden</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 3. TEMPLATE / SCRATCH EDITOR FORM ================= */}
          {(mode === 'TEMPLATE_FORM' || mode === 'SCRATCH_FORM') && (
            <form onSubmit={handleSaveExercise} className="space-y-6">
              {/* Back / Navigation */}
              <div className="flex items-center justify-between border-b border-[#252525] pb-3">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="text-xs text-slate-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Avbryt och återgå till listan</span>
                </button>

                <span className="text-xs font-black text-orange-400">
                  {editingExerciseId ? 'Redigerar övning' : mode === 'TEMPLATE_FORM' ? 'Bygger från mall' : 'Bygger från scratch'}
                </span>
              </div>

              {/* Grundläggande inställningar */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  <span>1. Övningsinformation & Målgrupp</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      Övningstitel *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="T.ex. Övning 2: Kantbalk & Armering på mark"
                      className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-sm text-white font-bold placeholder-slate-500 outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      Övningskod (elever anger denna för att ladda övningen) *
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="T.ex. GRUND-201"
                      className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-sm text-orange-400 font-mono font-bold outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      Målgrupp / Elevklass *
                    </label>
                    <select
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-xs text-white font-semibold outline-none cursor-pointer"
                    >
                      <option value="Alla grupper">Alla grupper / klasser</option>
                      {STANDARD_STUDENT_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      Beskrivning & Uppgiftskrav
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Kort beskrivning av övningens syfte och vad eleven förväntas uppnå..."
                      className="w-full p-3 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none resize-none"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">
                      Handledarinstruktioner för övningen
                    </label>
                    <textarea
                      rows={2}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Instruktioner som visas i övningen (t.ex. säkerhetskrav, kontrollmått)..."
                      className="w-full p-3 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Riktmått & Kryssmått */}
                <div className="pt-2 border-t border-[#262626] space-y-2">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Riktmått för övningen (Valfritt):</span>
                    {sideA && sideB && (
                      <span className="text-[11px] font-mono font-bold text-emerald-400">
                        Beräknad diagonal (kryssmått): {Math.sqrt(sideA * sideA + sideB * sideB).toFixed(2)} m
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Sida A / Längd (meter):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={sideA || ''}
                        onChange={(e) => setSideA(e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="T.ex. 10.0"
                        className="w-full min-h-[40px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Sida B / Bredd (meter):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={sideB || ''}
                        onChange={(e) => setSideB(e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="T.ex. 8.0"
                        className="w-full min-h-[40px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Fall (cm per meter):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={fallCmPerM || ''}
                        onChange={(e) => setFallCmPerM(e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="T.ex. 1.0"
                        className="w-full min-h-[40px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Externa ritningar och länkar */}
                <div className="pt-2 border-t border-[#262626] space-y-2">
                  <div className="text-xs font-bold text-slate-300">
                    Bifoga ritningslänkar eller instruktionsfilmer:
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="T.ex. Ritning M30 Grundplan"
                      className="flex-1 min-h-[38px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white outline-none"
                    />
                    <input
                      type="text"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="URL (https://...)"
                      className="flex-1 min-h-[38px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="px-3.5 min-h-[38px] bg-[#222222] hover:bg-[#2c2c2c] text-slate-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      + Lägg till länk
                    </button>
                  </div>

                  {links.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {links.map((l) => (
                        <div
                          key={l.id}
                          className="px-2.5 py-1 rounded-lg bg-[#141414] border border-[#2e2e2e] flex items-center gap-2 text-xs text-slate-300"
                        >
                          <ExternalLink className="w-3 h-3 text-orange-400" />
                          <span>{l.title}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLink(l.id)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ================= 2. FASER OCH MOMENT ================= */}
              <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#252525] pb-3">
                  <div>
                    <div className="text-xs font-black text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      <span>2. Faser & Momentinställningar ({activeMoments.length} valda)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bocka för vilka moment som ska ingå. Klicka på ett moment för att anpassa krav på fotobevis, AMA och instruktioner.
                    </p>
                  </div>

                  {mode === 'SCRATCH_FORM' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newPhaseName}
                        onChange={(e) => setNewPhaseName(e.target.value)}
                        placeholder="Nytt fasnamn (t.ex. Schakt)..."
                        className="min-h-[36px] px-3 bg-[#121212] border border-[#333333] rounded-xl text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewPhase}
                        className="min-h-[36px] px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                      >
                        + Lägg till fas
                      </button>
                    </div>
                  )}
                </div>

                {/* Phase Accordions */}
                <div className="space-y-3">
                  {Object.keys(phasesMap).map((phaseKey) => {
                    const phaseNum = Number(phaseKey);
                    const phaseData = phasesMap[phaseNum];
                    const isExpanded = expandedPhaseNum === phaseNum;
                    const phaseMoments = phaseData.moments;
                    const activeCountInPhase = phaseMoments.filter((m) =>
                      activeMoments.some((x) => x.id === m.id)
                    ).length;

                    return (
                      <div
                        key={phaseNum}
                        className="border border-[#2b2b2b] rounded-2xl bg-[#141414] overflow-hidden"
                      >
                        {/* Phase Header */}
                        <div className="p-3.5 px-4 flex items-center justify-between gap-3 bg-[#181818] cursor-pointer select-none">
                          <div
                            onClick={() => setExpandedPhaseNum(isExpanded ? null : phaseNum)}
                            className="flex items-center gap-2.5 flex-1 min-w-0"
                          >
                            <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 font-black text-xs flex items-center justify-center shrink-0">
                              {phaseNum}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-white truncate">
                              {phaseData.name}
                            </span>
                            <span className="text-[10px] bg-[#121212] text-slate-400 border border-[#2b2b2b] px-2 py-0.5 rounded-full font-bold">
                              {activeCountInPhase} av {phaseMoments.length} aktiva
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTogglePhase(phaseNum, phaseMoments);
                              }}
                              className="text-[10px] text-orange-400 hover:text-orange-300 font-bold underline px-1 cursor-pointer"
                            >
                              {activeCountInPhase > 0 ? 'Avmarkera alla' : 'Välj alla i fasen'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedPhaseNum(isExpanded ? null : phaseNum)}
                              className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Phase Moments List */}
                        {isExpanded && (
                          <div className="p-3 sm:p-4 space-y-2 border-t border-[#232323]">
                            {phaseMoments.map((moment) => {
                              const isChecked = activeMoments.some((m) => m.id === moment.id);
                              const isDetailOpen = expandedMomentId === moment.id;
                              const currentMoment = activeMoments.find((m) => m.id === moment.id) || moment;

                              return (
                                <div
                                  key={moment.id}
                                  className={`rounded-xl border transition-all ${
                                    isChecked
                                      ? 'bg-[#191919] border-orange-500/30'
                                      : 'bg-[#121212] border-[#242424] opacity-60'
                                  }`}
                                >
                                  {/* Moment summary row */}
                                  <div className="p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleMoment(moment.id, moment)}
                                        className="w-4 h-4 rounded border-slate-700 text-orange-500 accent-orange-500 cursor-pointer shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-white truncate">
                                            {currentMoment.id}: {currentMoment.title}
                                          </span>
                                          {currentMoment.amaCode && (
                                            <span className="text-[10px] font-mono bg-[#141414] text-slate-400 border border-[#2b2b2b] px-1.5 py-0.2 rounded shrink-0">
                                              {currentMoment.amaCode}
                                            </span>
                                          )}
                                          {currentMoment.criticalValidationHint && (
                                            <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                                              <Camera className="w-2.5 h-2.5" />
                                              <span>Fotokrav</span>
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                          {currentMoment.instruction}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isChecked && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedMomentId(isDetailOpen ? null : moment.id)
                                          }
                                          className="text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-950/40 hover:bg-orange-950 px-2 py-1 rounded-md border border-orange-800/60 cursor-pointer transition-colors"
                                        >
                                          {isDetailOpen ? 'Dölj inställningar' : 'Inställningar'}
                                        </button>
                                      )}

                                      {moment.id.includes('custom') && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMoment(moment.id)}
                                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                                          title="Ta bort moment"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Detailed moment settings editor */}
                                  {isChecked && isDetailOpen && (
                                    <div className="p-3.5 pt-2 border-t border-[#262626] bg-[#141414] space-y-3 animate-in fade-in">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                                            Momenttitel
                                          </label>
                                          <input
                                            type="text"
                                            value={currentMoment.title}
                                            onChange={(e) =>
                                              handleUpdateMomentProperty(moment.id, 'title', e.target.value)
                                            }
                                            className="w-full min-h-[34px] px-2.5 bg-[#181818] border border-[#333333] rounded-lg text-xs text-white outline-none"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                                            AMA-kod & Tolerans (t.ex. ±5 mm)
                                          </label>
                                          <input
                                            type="text"
                                            value={currentMoment.amaCode}
                                            onChange={(e) =>
                                              handleUpdateMomentProperty(moment.id, 'amaCode', e.target.value)
                                            }
                                            className="w-full min-h-[34px] px-2.5 bg-[#181818] border border-[#333333] rounded-lg text-xs text-white outline-none font-mono"
                                          />
                                        </div>

                                        <div className="sm:col-span-2 space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                                            Instruktion för eleven
                                          </label>
                                          <textarea
                                            rows={2}
                                            value={currentMoment.instruction}
                                            onChange={(e) =>
                                              handleUpdateMomentProperty(moment.id, 'instruction', e.target.value)
                                            }
                                            className="w-full p-2 bg-[#181818] border border-[#333333] rounded-lg text-xs text-white outline-none resize-none"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                                            Tips till eleven i fält
                                          </label>
                                          <input
                                            type="text"
                                            value={currentMoment.studentTip || ''}
                                            onChange={(e) =>
                                              handleUpdateMomentProperty(moment.id, 'studentTip', e.target.value)
                                            }
                                            className="w-full min-h-[34px] px-2.5 bg-[#181818] border border-[#333333] rounded-lg text-xs text-white outline-none"
                                          />
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase block">
                                            Obligatoriskt fotokrav
                                          </label>
                                          <label className="flex items-center gap-2 min-h-[34px] cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={!!currentMoment.criticalValidationHint}
                                              onChange={(e) =>
                                                handleUpdateMomentProperty(
                                                  moment.id,
                                                  'criticalValidationHint',
                                                  e.target.checked
                                                    ? 'Obligatoriskt fotobevis krävs för godkänd kontroll.'
                                                    : undefined
                                                )
                                              }
                                              className="w-4 h-4 rounded border-slate-700 text-orange-500 accent-orange-500 cursor-pointer"
                                            />
                                            <span className="text-xs text-slate-300">
                                              Kräv bild för att godkänna momentet
                                            </span>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Add extra custom moment to this phase */}
                            {addingToPhaseNum === phaseNum ? (
                              <div className="p-3 rounded-xl border border-dashed border-orange-500/40 bg-[#161616] space-y-2 mt-2">
                                <div className="text-xs font-bold text-orange-400">
                                  Lägg till nytt moment i {phaseData.name}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={newMomentTitle}
                                    onChange={(e) => setNewMomentTitle(e.target.value)}
                                    placeholder="Momenttitel..."
                                    className="w-full min-h-[34px] px-2.5 bg-[#101010] border border-[#333333] rounded-lg text-xs text-white outline-none"
                                  />
                                  <input
                                    type="text"
                                    value={newMomentAma}
                                    onChange={(e) => setNewMomentAma(e.target.value)}
                                    placeholder="AMA-kod (valfritt)..."
                                    className="w-full min-h-[34px] px-2.5 bg-[#101010] border border-[#333333] rounded-lg text-xs text-white outline-none font-mono"
                                  />
                                  <input
                                    type="text"
                                    value={newMomentInstruction}
                                    onChange={(e) => setNewMomentInstruction(e.target.value)}
                                    placeholder="Instruktion..."
                                    className="sm:col-span-2 w-full min-h-[34px] px-2.5 bg-[#101010] border border-[#333333] rounded-lg text-xs text-white outline-none"
                                  />
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={newMomentRequirePhoto}
                                      onChange={(e) => setNewMomentRequirePhoto(e.target.checked)}
                                      className="w-3.5 h-3.5 accent-orange-500"
                                    />
                                    <span>Kräv foto</span>
                                  </label>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setAddingToPhaseNum(null)}
                                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                                    >
                                      Avbryt
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddMomentToPhase(phaseNum, phaseData.name)}
                                      className="px-3 py-1 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs rounded-lg"
                                    >
                                      Lägg till
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAddingToPhaseNum(phaseNum)}
                                className="w-full py-2 border border-dashed border-[#2b2b2b] hover:border-orange-500/50 rounded-xl text-slate-400 hover:text-orange-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Lägg till ett extra moment i denna fas</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setMode('LIST')}
                  className="min-h-[46px] px-5 bg-[#222222] hover:bg-[#2c2c2c] text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Avbryt
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[46px] px-6 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Spara & Publicera övning online</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
