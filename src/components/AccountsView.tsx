import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, AppLicense, TeacherExercise } from '../types';
import {
  User,
  ShieldCheck,
  Shield,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Key,
  Mail,
  GraduationCap,
  Building,
  RefreshCw,
  LogOut,
  UserCheck,
  Clock,
  Sparkles,
  Search,
  Lock,
  ShieldAlert,
  Copy,
  Settings,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  Edit3,
  Filter,
  Users,
  ChevronDown,
  Check,
  BookOpen,
  FolderPlus,
} from 'lucide-react';
import { safeFetchJson } from '../services/apiHelper';
import {
  saveUserToCloud,
  fetchAllUsersFromCloud,
  deleteUserFromCloud,
  canEditUser,
  canDeleteUser,
  STANDARD_STUDENT_GROUPS,
} from '../services/userService';
import { TeacherExerciseCreatorModal } from './TeacherExerciseCreatorModal';

interface AccountsViewProps {
  currentUser: UserAccount | null;
  onUserLoggedIn: (user: UserAccount) => void;
  onUserLoggedOut: () => void;
  onBack: () => void;
  onStartExerciseProject?: (exercise: TeacherExercise) => void;
}

type SortOrder = 'NAME_ASC' | 'NAME_DESC' | 'GROUP' | 'LAST_LOGIN' | 'NEWEST';

export const AccountsView: React.FC<AccountsViewProps> = ({
  currentUser,
  onUserLoggedIn,
  onUserLoggedOut,
  onBack,
  onStartExerciseProject,
}) => {
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'STUDENT' | 'TEACHER' | 'ADMIN'>('ALL');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NAME_ASC');

  // Exercise Creator modal
  const [isExerciseCreatorOpen, setIsExerciseCreatorOpen] = useState(false);

  // License & Permissions State
  const [license, setLicense] = useState<AppLicense>({
    status: 'LICENSED',
    licenseKey: 'SKOLA-2026-FALTHJALP',
    schoolName: 'Bygg- & Anläggningsutbildning',
    validUntil: '2028-12-31',
    maxSeats: 150,
    allowTeacherAccountCreation: true,
  });
  const [copiedKey, setCopiedKey] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [customLicenseKey, setCustomLicenseKey] = useState(license.licenseKey);

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('1234');
  const [newUserRole, setNewUserRole] = useState<UserRole>('STUDENT');
  const [newUserOrg, setNewUserOrg] = useState('Bygg- & Anläggningsprogrammet');
  const [newUserGroup, setNewUserGroup] = useState('Byggprogrammet (BA)');
  const [newUserCustomGroup, setNewUserCustomGroup] = useState('');
  const [customGroups, setCustomGroups] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('faltkoll_custom_groups');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editCustomGroup, setEditCustomGroup] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('STUDENT');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Password inline editing state
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Admin / Teacher Login State (when accessed without management privileges)
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isLoggingInAdmin, setIsLoggingInAdmin] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [showTeacherLoginForm, setShowTeacherLoginForm] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const isTeacher = currentUser?.role === 'TEACHER';
  const isStudent = currentUser?.role === 'STUDENT';
  const canManageAccounts = isAdmin || isTeacher;

  const handleAdminLoginSubmit = async (e?: React.FormEvent, directEmail?: string, directPass?: string) => {
    if (e) e.preventDefault();
    setAdminLoginError(null);

    const emailToUse = (directEmail || adminEmail).trim();
    const passToUse = (directPass || adminPassword).trim();

    if (!emailToUse || !passToUse) {
      setAdminLoginError('Vänligen ange både e-post och lösenord.');
      return;
    }

    setIsLoggingInAdmin(true);

    try {
      const res = await safeFetchJson<{ user: UserAccount }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse, password: passToUse }),
      });

      if (res.ok && res.data?.user) {
        if (res.data.user.role !== 'ADMIN' && res.data.user.role !== 'TEACHER') {
          throw new Error('Detta konto har inte lärar- eller administratörsbehörighet.');
        }
        onUserLoggedIn(res.data.user);
        try {
          localStorage.setItem('falthjalp_current_user', JSON.stringify(res.data.user));
        } catch {}
        setSuccessMsg(`Välkommen! Inloggad som ${res.data.user.displayName} (${res.data.user.role}).`);
        setTimeout(() => setSuccessMsg(null), 4000);
        return;
      }

      // Check local fallback (works offline and on GitHub Pages)
      const norm = emailToUse.toLowerCase();
      if (
        norm === 'admin@faltkoll.se' ||
        norm === 'admin@skola.se' ||
        norm === 'admin' ||
        norm === 'admin@falthjalp.se'
      ) {
        if (passToUse === 'admin123' || passToUse === 'admin' || passToUse === 'Admin2026!' || passToUse === '1234') {
          const adminUser: UserAccount = {
            id: 'usr_admin_main',
            email: norm.includes('@') ? norm : 'admin@faltkoll.se',
            displayName: 'Huvudadministratör (Admin)',
            role: 'ADMIN',
            password: passToUse,
            schoolOrCompany: 'Anläggningsutbildning & Egenkontroll',
            createdAt: '2026-09-26 10:00',
            lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };
          onUserLoggedIn(adminUser);
          try {
            localStorage.setItem('falthjalp_current_user', JSON.stringify(adminUser));
          } catch {}
          setSuccessMsg('Välkommen! Du är nu inloggad som Huvudadministratör.');
          setTimeout(() => setSuccessMsg(null), 4000);
          return;
        }
      }

      // Check teacher Angfar
      if (norm === 'angfar' || norm === 'angfar@skola.se') {
        if (passToUse === '1234' || passToUse === 'larare123') {
          const teacherUser: UserAccount = {
            id: 'usr_angfar_teacher',
            email: 'angfar@skola.se',
            displayName: 'Angfar',
            role: 'TEACHER',
            password: '1234',
            schoolOrCompany: 'Bygg- & Anläggningsutbildning',
            createdAt: '2026-01-10 08:00',
            lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 16),
          };
          onUserLoggedIn(teacherUser);
          try {
            localStorage.setItem('falthjalp_current_user', JSON.stringify(teacherUser));
          } catch {}
          setSuccessMsg('Välkommen! Du är nu inloggad som Yrkeslärare Angfar.');
          setTimeout(() => setSuccessMsg(null), 4000);
          return;
        }
      }

      // Check allUsers in state or localStorage for custom teacher/admin accounts
      const localAdmin = allUsers.find(
        (u) =>
          (u.role === 'ADMIN' || u.role === 'TEACHER') &&
          (u.email.toLowerCase() === norm || u.displayName.toLowerCase() === norm) &&
          (!u.password || u.password === passToUse)
      );

      if (localAdmin) {
        onUserLoggedIn(localAdmin);
        try {
          localStorage.setItem('falthjalp_current_user', JSON.stringify(localAdmin));
        } catch {}
        setSuccessMsg(`Välkommen! Inloggad som ${localAdmin.displayName}.`);
        setTimeout(() => setSuccessMsg(null), 4000);
        return;
      }

      setAdminLoginError('Felaktig e-post eller lösenord. Kontrollera dina uppgifter.');
    } catch (err: any) {
      setAdminLoginError(err?.message || 'Kunde inte logga in. Kontrollera nätverket.');
    } finally {
      setIsLoggingInAdmin(false);
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      let serverUsers: UserAccount[] = [];
      const res = await safeFetchJson<{ users: UserAccount[] }>(
        `/api/users?callerRole=${currentUser?.role || ''}&callerId=${currentUser?.id || ''}`
      );
      if (res.ok && res.data?.users && Array.isArray(res.data.users)) {
        serverUsers = res.data.users;
      }

      // Check Google Cloud Firestore directly for online users
      let cloudUsers: UserAccount[] = [];
      try {
        cloudUsers = await fetchAllUsersFromCloud();
      } catch {}

      // Check localStorage for saved/created accounts
      let localUsers: UserAccount[] = [];
      try {
        const raw = localStorage.getItem('falthjalp_all_users');
        if (raw) localUsers = JSON.parse(raw);
      } catch {}

      // Default baseline accounts if nothing is saved yet
      const baselineUsers: UserAccount[] = [
        {
          id: 'usr_angfar_teacher',
          email: 'angfar@skola.se',
          displayName: 'Angfar',
          role: 'TEACHER',
          password: '1234',
          schoolOrCompany: 'Bygg- & Anläggningsutbildning',
          studentGroup: 'Byggprogrammet (BA)',
          createdAt: '2026-01-10',
        },
        {
          id: 'usr_admin_main',
          email: 'admin@faltkoll.se',
          displayName: 'Skoladministratör / Ägare',
          role: 'ADMIN',
          password: 'admin',
          schoolOrCompany: 'Anläggningssektionen & Skolledning',
          createdAt: '2026-01-01',
        },
        {
          id: 'usr_larare_1',
          email: 'larare@skola.se',
          displayName: 'Yrkeslärare Mark & Betong',
          role: 'TEACHER',
          password: 'larare123',
          schoolOrCompany: 'Yrkeslärare Mark & Betong',
          studentGroup: 'Anläggning & Maskin',
          createdAt: '2026-01-10',
        },
        {
          id: 'usr_elev_1',
          email: 'elev@skola.se',
          displayName: 'Elev / Lärling (Exempel)',
          role: 'STUDENT',
          password: '1234',
          schoolOrCompany: 'Bygg & Anläggning Grupp A',
          studentGroup: 'Byggprogrammet (BA)',
          createdAt: '2026-02-01',
        },
      ];

      // Merge: serverUsers, cloudUsers, localUsers, baselineUsers
      const seen = new Set<string>();
      const uniqueUsers: UserAccount[] = [];
      
      [...serverUsers, ...cloudUsers, ...localUsers, ...baselineUsers].forEach((u, i) => {
        const key = u.email ? u.email.toLowerCase() : (u.id || `usr_${i}`);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueUsers.push(u);
        }
      });

      setAllUsers(uniqueUsers);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(uniqueUsers));
      } catch {}
    } catch {
      // Emergency fallback
      setAllUsers([
        {
          id: 'usr_admin_main',
          email: 'admin@faltkoll.se',
          displayName: 'Skoladministratör / Ägare',
          role: 'ADMIN',
          password: 'admin',
          schoolOrCompany: 'Skolledning',
          createdAt: '2026-01-01',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // Load license settings from localStorage if available
    try {
      const saved = localStorage.getItem('falthjalp_license');
      if (saved) {
        setLicense((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch {}

    // Load server system settings
    safeFetchJson<{ requireLoginOnStartup?: boolean }>('/api/system/settings')
      .then((res) => {
        if (res.ok && res.data && res.data.requireLoginOnStartup !== undefined) {
          setLicense((prev) => ({
            ...prev,
            requireLoginOnStartup: res.data!.requireLoginOnStartup,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleTeacherCreation = () => {
    if (!isAdmin) return;
    const updated: AppLicense = {
      ...license,
      allowTeacherAccountCreation: !license.allowTeacherAccountCreation,
    };
    setLicense(updated);
    try {
      localStorage.setItem('falthjalp_license', JSON.stringify(updated));
    } catch {}
    safeFetchJson('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowTeacherCreateTeacherAccounts: updated.allowTeacherAccountCreation,
      }),
    }).catch(() => {});
  };

  const handleToggleRequireLogin = async (newValue: boolean) => {
    if (!isAdmin) return;
    setLicense((prev) => ({ ...prev, requireLoginOnStartup: newValue }));
    try {
      const saved = { ...license, requireLoginOnStartup: newValue };
      localStorage.setItem('falthjalp_license', JSON.stringify(saved));
      await safeFetchJson('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireLoginOnStartup: newValue }),
      });
      setSuccessMsg(
        newValue
          ? 'Inloggningskravet har aktiverats. Alla användare måste nu logga in vid start.'
          : 'Demoläge aktiverat! Inloggningskravet är borttaget så alla kan gå direkt till övningar.'
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('Kunde inte spara systeminställningen: ' + (err.message || 'Okänt fel'));
    }
  };

  const handleCopyLicenseKey = () => {
    try {
      navigator.clipboard.writeText(license.licenseKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {}
  };

  const handleSaveCustomLicenseKey = () => {
    if (!customLicenseKey.trim()) return;
    const updated = { ...license, licenseKey: customLicenseKey.trim().toUpperCase() };
    setLicense(updated);
    setIsEditingKey(false);
    try {
      localStorage.setItem('falthjalp_license', JSON.stringify(updated));
    } catch {}
    setSuccessMsg('Skolans licensnyckel uppdaterades!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Open edit modal for an account
  const handleOpenEditUserModal = (targetUser: UserAccount) => {
    if (!canEditUser(currentUser, targetUser)) {
      alert('Du har inte behörighet att redigera detta konto.');
      return;
    }

    setEditingUser(targetUser);
    setEditName(targetUser.displayName);
    setEditEmail(targetUser.email);
    setEditPassword(targetUser.password || '');
    setEditSchool(targetUser.schoolOrCompany || '');
    setEditRole(targetUser.role);

    const isStandardGroup = STANDARD_STUDENT_GROUPS.includes(targetUser.studentGroup || '');
    if (isStandardGroup) {
      setEditGroup(targetUser.studentGroup || 'Byggprogrammet (BA)');
      setEditCustomGroup('');
    } else if (targetUser.studentGroup) {
      setEditGroup('CUSTOM');
      setEditCustomGroup(targetUser.studentGroup);
    } else {
      setEditGroup('Byggprogrammet (BA)');
      setEditCustomGroup('');
    }
  };

  // Save changes from Edit User Modal
  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const finalGroup = editGroup === 'CUSTOM' ? editCustomGroup.trim() || 'Osorterad' : editGroup;
    const cleanName = editName.trim();
    const cleanEmail = editEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      alert('Namn och e-post/användarnamn får inte vara tomt.');
      return;
    }

    setIsSavingEdit(true);

    const updatedUser: UserAccount = {
      ...editingUser,
      displayName: cleanName,
      email: cleanEmail,
      schoolOrCompany: editSchool.trim() || editingUser.schoolOrCompany,
      studentGroup: finalGroup,
      role: isAdmin ? editRole : editingUser.role, // Teacher cannot change role
      password: editPassword.trim() || editingUser.password || '1234',
    };

    try {
      // 1. Update on server
      await safeFetchJson(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: updatedUser.displayName,
          email: updatedUser.email,
          schoolOrCompany: updatedUser.schoolOrCompany,
          studentGroup: updatedUser.studentGroup,
          role: updatedUser.role,
          password: updatedUser.password,
        }),
      });

      // 2. Update directly in Google Cloud Firestore (always online)
      await saveUserToCloud(updatedUser);

      // 3. Update in local state & localStorage
      const updatedList = allUsers.map((u) => (u.id === editingUser.id ? updatedUser : u));
      setAllUsers(updatedList);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(updatedList));
      } catch {}

      // If editing current logged in user, update session
      if (currentUser?.id === editingUser.id) {
        onUserLoggedIn(updatedUser);
      }

      setEditingUser(null);
      setSuccessMsg(`Kontot för "${cleanName}" har sparats online i molnet!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Kunde inte uppdatera konto: ' + (err.message || 'Okänt fel'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create new user (Student or Teacher)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setErrorMsg('Vänligen ange både namn och e-post/användarnamn.');
      return;
    }

    // Role assignment security
    const assignedRole: UserRole = isAdmin ? newUserRole : 'STUDENT';
    const cleanEmail = newUserEmail.trim().toLowerCase();
    const cleanName = newUserName.trim();

    try {
      setIsCreating(true);
      setErrorMsg(null);

      const finalGroup = newUserGroup === 'CUSTOM'
        ? (newUserCustomGroup.trim() || 'Osorterad / Allmän')
        : newUserGroup;

      if (newUserGroup === 'CUSTOM' && newUserCustomGroup.trim()) {
        const gn = newUserCustomGroup.trim();
        if (!customGroups.includes(gn)) {
          const updatedG = [...customGroups, gn];
          setCustomGroups(updatedG);
          try { localStorage.setItem('faltkoll_custom_groups', JSON.stringify(updatedG)); } catch {}
        }
      }

      const localNewUser: UserAccount = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        displayName: cleanName,
        email: cleanEmail,
        role: assignedRole,
        password: newUserPassword.trim() || '1234',
        schoolOrCompany: newUserOrg.trim() || license.schoolName,
        studentGroup: finalGroup,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 10),
      };

      // Push to backend server
      try {
        const res = await safeFetchJson<{ user: UserAccount }>('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            displayName: cleanName,
            role: assignedRole,
            password: newUserPassword.trim() || '1234',
            schoolOrCompany: newUserOrg.trim() || license.schoolName,
            studentGroup: finalGroup,
          }),
        });

        if (res.ok && res.data?.user) {
          localNewUser.id = res.data.user.id;
        }
      } catch {
        // Backend offline / static preview - local and Firestore take over
      }

      // Guarantee instant live sync directly to Google Cloud Firestore
      try {
        await saveUserToCloud(localNewUser);
      } catch (cloudErr) {
        console.warn('Could not sync user to Firestore:', cloudErr);
      }

      // Persist in state & localStorage
      const updated = [localNewUser, ...allUsers];
      setAllUsers(updated);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(updated));
      } catch {}

      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('1234');
      setSuccessMsg(`Nytt konto för "${cleanName}" har sparats online och är redo för inloggning!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg('Kunde inte skapa konto: ' + (err.message || 'Okänt fel'));
    } finally {
      setIsCreating(false);
    }
  };

  // Change role (Admin only)
  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    try {
      await safeFetchJson(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const updated = allUsers.map((u) => (u.id === userId ? { ...u, role: newRole } : u));
      setAllUsers(updated);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(updated));
      } catch {}

      const targetUser = updated.find((u) => u.id === userId);
      if (targetUser) {
        saveUserToCloud(targetUser).catch(() => {});
      }

      setSuccessMsg('Behörigheten uppdaterades framgångsrikt!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Kunde inte ändra roll.');
    }
  };

  // Save single password change inline
  const handleSavePassword = async (userId: string) => {
    if (!newPasswordVal.trim()) return;

    try {
      await safeFetchJson(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPasswordVal.trim() }),
      });

      const updated = allUsers.map((u) =>
        u.id === userId ? { ...u, password: newPasswordVal.trim() } : u
      );
      setAllUsers(updated);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(updated));
      } catch {}

      // Update in Google Cloud Firestore
      const targetUser = updated.find((u) => u.id === userId);
      if (targetUser) {
        saveUserToCloud(targetUser).catch(() => {});
      }

      setSuccessMsg('Lösenordet uppdaterades framgångsrikt online!');
      setEditingPasswordUserId(null);
      setNewPasswordVal('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Kunde inte uppdatera lösenordet.');
    }
  };

  // Delete user account
  const handleDeleteUser = async (userId: string, name: string) => {
    const userToDelete = allUsers.find((u) => u.id === userId);
    if (!userToDelete || !canDeleteUser(currentUser, userToDelete)) {
      alert('Du har inte behörighet att ta bort detta konto.');
      return;
    }

    if (!confirm(`Är du säker på att du vill ta bort kontot för "${name}"?`)) return;

    try {
      await safeFetchJson(`/api/users/${userId}`, { method: 'DELETE' });

      // Delete from Firestore directly
      deleteUserFromCloud(userId, userToDelete?.email).catch(() => {});

      const updated = allUsers.filter((u) => u.id !== userId);
      setAllUsers(updated);
      try {
        localStorage.setItem('falthjalp_all_users', JSON.stringify(updated));
      } catch {}
      setSuccessMsg(`Kontot för "${name}" togs bort.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Kunde inte ta bort användaren.');
    }
  };

  // Switch to user account (impersonate/test)
  const handleSwitchUser = (targetUser: UserAccount) => {
    onUserLoggedIn(targetUser);
    try {
      localStorage.setItem('falthjalp_current_user', JSON.stringify(targetUser));
    } catch {}
    setSuccessMsg(`Du är nu inloggad som ${targetUser.displayName} (${targetUser.role})`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Filter and sort users
  const filteredUsers = allUsers
    .filter((u) => {
      const matchesRole = activeFilter === 'ALL' || u.role === activeFilter;
      const matchesGroup =
        selectedGroupFilter === 'ALL' ||
        u.studentGroup === selectedGroupFilter ||
        (!u.studentGroup && selectedGroupFilter === 'Osorterad / Allmän');
      const matchesSearch =
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.schoolOrCompany && u.schoolOrCompany.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.studentGroup && u.studentGroup.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesRole && matchesGroup && matchesSearch;
    })
    .sort((a, b) => {
      if (sortOrder === 'NAME_ASC') {
        return a.displayName.localeCompare(b.displayName, 'sv');
      }
      if (sortOrder === 'NAME_DESC') {
        return b.displayName.localeCompare(a.displayName, 'sv');
      }
      if (sortOrder === 'GROUP') {
        return (a.studentGroup || 'zzz').localeCompare(b.studentGroup || 'zzz', 'sv');
      }
      if (sortOrder === 'LAST_LOGIN') {
        return (b.lastLogin || '').localeCompare(a.lastLogin || '');
      }
      if (sortOrder === 'NEWEST') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      return 0;
    });

  // Calculate statistics
  const totalStudents = allUsers.filter((u) => u.role === 'STUDENT').length;
  const totalTeachers = allUsers.filter((u) => u.role === 'TEACHER').length;

  // When user is not logged in or is a STUDENT, show student profile or admin login
  if (!canManageAccounts) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12 space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] px-4 bg-[#1e1e1e] hover:bg-[#282828] text-slate-300 hover:text-white border border-[#333333] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-orange-400" />
            <span>Tillbaka till övningar</span>
          </button>
          <span className="text-xs font-bold text-slate-400">
            FältKoll Administration
          </span>
        </div>

        {/* If logged in as STUDENT: Show clear student card */}
        {isStudent && currentUser && !showTeacherLoginForm && (
          <div className="bg-[#181818] border-2 border-[#2c2c2c] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center justify-center mx-auto text-2xl font-bold">
                👷
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Mitt Elevkonto
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Inloggad i skolsystemet som elev/lärling.
              </p>
            </div>

            <div className="bg-[#121212] border border-[#262626] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-[#202020] pb-2">
                <span className="text-slate-400 font-bold">Namn:</span>
                <span className="text-white font-black">{currentUser.displayName}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-[#202020] pb-2">
                <span className="text-slate-400 font-bold">E-post / Elev-ID:</span>
                <span className="text-white font-mono">{currentUser.email}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-[#202020] pb-2">
                <span className="text-slate-400 font-bold">Klass / Grupp:</span>
                <span className="text-orange-400 font-bold">{currentUser.studentGroup || 'Byggprogrammet'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold">Skola:</span>
                <span className="text-slate-300">{currentUser.schoolOrCompany || 'Bygg- & Anläggningsutbildning'}</span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-2xl text-xs text-blue-200 leading-relaxed">
              💡 <strong>Behörighetsinformation:</strong> Konton, grupper och övningsupplägg administreras av din lärare eller skolans administratör. Elever kan inte redigera behörigheter.
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowTeacherLoginForm(true)}
                className="w-full min-h-[44px] bg-[#222222] hover:bg-[#2c2c2c] text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Key className="w-4 h-4 text-orange-400" />
                <span>Logga in som lärare eller administratör</span>
              </button>

              <button
                type="button"
                onClick={onUserLoggedOut}
                className="w-full min-h-[44px] bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-900/60 font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              >
                Logga ut från elevkontot
              </button>
            </div>
          </div>
        )}

        {/* Admin / Teacher Login Form (if not logged in as student or clicked switch) */}
        {(!isStudent || showTeacherLoginForm) && (
          <div className="bg-[#181818] border-2 border-orange-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/80">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Lärar- & Admininloggning
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Logga in som Yrkeslärare eller Administratör för att hantera elevkonton, klasser och skapa anpassade fältövningar.
              </p>
            </div>

            {/* Error message */}
            {adminLoginError && (
              <div className="p-3.5 bg-rose-950/80 border border-rose-500/80 rounded-2xl flex items-start gap-2.5 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{adminLoginError}</div>
              </div>
            )}

            {/* Standard Login Form */}
            <form onSubmit={(e) => handleAdminLoginSubmit(e)} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  E-postadress eller användarnamn:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="T.ex. Angfar eller admin@skola.se"
                    className="w-full min-h-[48px] px-4 pl-10 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                  Lösenord:
                </label>
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Lösenord..."
                    className="w-full min-h-[48px] px-4 pl-10 pr-10 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    tabIndex={-1}
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingInAdmin}
                className="w-full min-h-[50px] bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-orange-500/20"
              >
                {isLoggingInAdmin ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Key className="w-4 h-4 stroke-[2.5]" />
                    <span>Logga in</span>
                  </>
                )}
              </button>

              {showTeacherLoginForm && isStudent && (
                <button
                  type="button"
                  onClick={() => setShowTeacherLoginForm(false)}
                  className="w-full text-center text-xs text-slate-400 hover:text-white pt-2 cursor-pointer"
                >
                  Tillbaka till mitt elevkonto
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-6 font-sans">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2c2c2c] pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded-full border border-orange-800/80">
              {isAdmin ? 'Systemägare & Skoladmin' : 'Yrkeslärarpanel'}
            </span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Skollicens Aktiv
            </span>
            <span className="text-xs font-bold text-slate-400 bg-[#1e1e1e] px-2.5 py-0.5 rounded-full border border-[#333]">
              {totalStudents} elever • {totalTeachers} lärare
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isAdmin ? 'Skolans Kontoadministration' : 'Hantera Elever & Klasser'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {isAdmin
              ? 'Administrera behörigheter, skapa elev- och lärarkonton, hantera skolklasser och licenser.'
              : 'Redigera dina elevers konton, byt lösenord, tilldela elevgrupper och skapa nya övningar.'}
          </p>
        </div>

        {/* Action Buttons: Övningskreatör & Tillbaka */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExerciseCreatorOpen(true)}
            className="min-h-[44px] px-4 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-xs sm:text-sm rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 transition-all"
          >
            <BookOpen className="w-4 h-4 stroke-[2.5]" />
            <span>Övningskreatör för lärare</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 bg-[#1e1e1e] hover:bg-[#282828] text-slate-300 hover:text-white border border-[#333333] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-orange-400" />
            <span>Till övningar</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/80 rounded-2xl flex items-center gap-3 text-emerald-200 text-xs sm:text-sm shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-950/80 border border-rose-500/80 rounded-2xl flex items-center gap-3 text-rose-200 text-xs sm:text-sm shadow-lg animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ADMIN ONLY: Startup Demo Mode Toggle & License Card */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Startup Demo Mode Toggle Card */}
          <div className="bg-[#181818] border-2 border-orange-500/30 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-4 h-4" />
                <span>Inloggningskrav vid start</span>
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                license.requireLoginOnStartup ? 'bg-orange-950 text-orange-300 border border-orange-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}>
                {license.requireLoginOnStartup ? 'Kräver inlogg' : 'Demoläge aktivt'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              När inloggningskravet är avstängt startar appen direkt i övningsvyn för alla användare utan att fråga efter lösenord.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleToggleRequireLogin(!license.requireLoginOnStartup)}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  license.requireLoginOnStartup
                    ? 'bg-orange-500 text-black shadow-md shadow-orange-500/20'
                    : 'bg-[#252525] hover:bg-[#303030] text-slate-300'
                }`}
              >
                {license.requireLoginOnStartup ? 'Stäng av inloggningskrav (Gör demo öppen)' : 'Aktivera inloggningskrav'}
              </button>
            </div>
          </div>

          {/* License Info Card */}
          <div className="bg-[#181818] border border-[#2c2c2c] rounded-3xl p-5 space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-orange-400" />
              <span>Skolans Licensnyckel</span>
            </span>

            <div className="flex items-center justify-between gap-2">
              <code className="text-sm sm:text-base font-mono font-black text-orange-400">
                {license.licenseKey}
              </code>
              <button
                type="button"
                onClick={handleCopyLicenseKey}
                className="px-2.5 py-1 bg-[#222] hover:bg-[#2c2c2c] text-white rounded-lg text-xs font-bold border border-[#444] flex items-center gap-1 cursor-pointer"
              >
                {copiedKey ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Kopierad' : 'Kopiera'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-snug">
              Elever och lärare kan ange denna licensnyckel för att låsa upp appen.
            </p>
          </div>
        </div>
      )}

      {/* Skapa nytt konto formulär */}
      {canManageAccounts && (
        <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#2c2c2c] pb-3">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-orange-400" />
              <span>Registrera nytt konto ({isAdmin ? 'Elev eller Lärare' : 'Elev'})</span>
            </h2>
            <span className="text-xs font-bold text-slate-400">
              Synkas direkt till molnet
            </span>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                För- och efternamn:
              </label>
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="T.ex. Johan Lindqvist"
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-medium text-sm outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                E-post eller Elev-ID / Användarnamn:
              </label>
              <input
                type="text"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="T.ex. johan.l@skola.se"
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-medium text-sm outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Lösenord / PIN:
              </label>
              <input
                type="text"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="T.ex. 1234"
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-medium text-sm outline-none font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Elevgrupp / Utbildningsprogram:
              </label>
              <select
                value={newUserGroup}
                onChange={(e) => setNewUserGroup(e.target.value)}
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-bold text-xs outline-none cursor-pointer"
              >
                {STANDARD_STUDENT_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Roll i appen:
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                disabled={!isAdmin}
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-bold text-xs outline-none cursor-pointer disabled:opacity-60"
              >
                <option value="STUDENT">Elev / Lärling (Genomför övningar)</option>
                {isAdmin && <option value="TEACHER">Lärare (Skapar övningar & klasser)</option>}
                {isAdmin && <option value="ADMIN">Skoladministratör (Full behörighet)</option>}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Skolenhet:
              </label>
              <input
                type="text"
                value={newUserOrg}
                onChange={(e) => setNewUserOrg(e.target.value)}
                placeholder="Skola eller företag..."
                className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-white font-medium text-xs outline-none"
              />
            </div>

            <div className="sm:col-span-3 pt-1">
              <button
                type="submit"
                disabled={isCreating}
                className="w-full min-h-[48px] px-6 bg-orange-500 hover:bg-orange-400 active:scale-98 text-black font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{isCreating ? 'Sparar konto online i molnet...' : 'Skapa och spara konto i molnet'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= ANVÄNDARLISTA MED GRUPP- OCH ROLLFILTER ================= */}
      <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2c2c2c] pb-4">
          <div>
            <h2 className="text-xl font-black text-white">
              Registrerade konton ({allUsers.length})
            </h2>
            <p className="text-xs text-slate-400">
              {isAdmin
                ? 'Huvudadmin kan redigera och hantera alla konton.'
                : 'Lärare kan redigera och byta lösenord på alla elever.'}
            </p>
          </div>

          {/* Sökfält och Sortering */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök namn, e-post eller grupp..."
                className="w-full min-h-[38px] pl-9 pr-3 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
              />
            </div>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="min-h-[38px] px-3 bg-[#121212] border border-[#333333] focus:border-orange-500 rounded-xl text-xs text-slate-300 font-bold outline-none cursor-pointer"
            >
              <option value="NAME_ASC">Sortera: Namn (A-Ö)</option>
              <option value="NAME_DESC">Sortera: Namn (Ö-A)</option>
              <option value="GROUP">Sortera: Grupp/Klass</option>
              <option value="LAST_LOGIN">Sortera: Senast inloggad</option>
              <option value="NEWEST">Sortera: Nyast först</option>
            </select>
          </div>
        </div>

        {/* Gruppfilter-chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span>Filtrera efter elevgrupp / klass:</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal">
              Visar {filteredUsers.length} av {allUsers.length} konton
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGroupFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                selectedGroupFilter === 'ALL'
                  ? 'bg-orange-500 text-black border-orange-400 font-black'
                  : 'bg-[#141414] text-slate-400 border-[#2c2c2c] hover:text-white'
              }`}
            >
              Alla grupper ({allUsers.length})
            </button>

            {STANDARD_STUDENT_GROUPS.map((group) => {
              const count = allUsers.filter(
                (u) =>
                  u.studentGroup === group ||
                  (!u.studentGroup && group === 'Osorterad / Allmän')
              ).length;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setSelectedGroupFilter(group)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedGroupFilter === group
                      ? 'bg-orange-500 text-black border-orange-400 font-black'
                      : 'bg-[#141414] text-slate-400 border-[#2c2c2c] hover:text-white'
                  }`}
                >
                  {group} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Rollfilter */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-xs text-slate-500 font-bold mr-1">Roll:</span>
          {(['ALL', 'STUDENT', 'TEACHER', 'ADMIN'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                activeFilter === filter
                  ? 'bg-slate-200 text-black border-white'
                  : 'bg-[#141414] text-slate-400 border-[#2c2c2c] hover:text-white'
              }`}
            >
              {filter === 'ALL'
                ? 'Alla'
                : filter === 'STUDENT'
                ? 'Elever'
                : filter === 'TEACHER'
                ? 'Lärare'
                : 'Administratörer'}
            </button>
          ))}
        </div>

        {/* Användarlista */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-slate-500 bg-[#141414] rounded-2xl border border-dashed border-[#2c2c2c] space-y-1">
              <p className="font-bold text-white">Inga konton matchade din sökning eller filter.</p>
              <p className="text-xs">Prova att välja "Alla grupper" eller rensa sökordet.</p>
            </div>
          ) : (
            filteredUsers.map((user, idx) => {
              const isCurrent = currentUser?.id === user.id;
              const isRootAdmin = user.role === 'ADMIN' && allUsers.filter((u) => u.role === 'ADMIN').length <= 1;
              const hasEditPermission = canEditUser(currentUser, user);
              const hasDeletePermission = canDeleteUser(currentUser, user);

              return (
                <div
                  key={`${user.id || 'usr'}_${idx}`}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-[#181e18] border-emerald-500/80 ring-1 ring-emerald-500/30'
                      : 'bg-[#141414] border-[#2c2c2c] hover:border-[#3c3c3c]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Left: Avatar & Metadata */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                          user.role === 'TEACHER'
                            ? 'bg-amber-500 text-black'
                            : user.role === 'ADMIN'
                            ? 'bg-purple-500 text-white'
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        }`}
                      >
                        {user.displayName.charAt(0)}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-bold text-white text-sm sm:text-base truncate">
                            {user.displayName}
                          </h3>

                          {/* Role tag */}
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              user.role === 'TEACHER'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : user.role === 'ADMIN'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : 'bg-orange-950 text-orange-300 border border-orange-800'
                            }`}
                          >
                            {user.role === 'TEACHER' ? 'Lärare' : user.role === 'ADMIN' ? 'Skoladmin' : 'Elev'}
                          </span>

                          {/* Student group tag */}
                          {user.studentGroup && (
                            <span className="text-[10px] font-bold bg-[#1e1e1e] text-orange-300 border border-[#333] px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              <span>{user.studentGroup}</span>
                            </span>
                          )}

                          {isCurrent && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                              Aktiv (Du)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                          <span className="font-mono text-slate-300">{user.email}</span>
                          {user.schoolOrCompany && (
                            <>
                              <span>•</span>
                              <span className="truncate">{user.schoolOrCompany}</span>
                            </>
                          )}
                          {user.lastLogin && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-slate-500">Inloggad: {user.lastLogin}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions based on rank */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#222]">
                      {/* Redigera konto knapp (Rank based) */}
                      {hasEditPermission && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditUserModal(user)}
                          className="min-h-[34px] px-3 bg-[#1e1e1e] hover:bg-[#282828] text-slate-200 hover:text-white rounded-xl border border-[#333] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Redigera namn, e-post, grupp eller lösenord"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                          <span>Redigera</span>
                        </button>
                      )}

                      {/* Snabb-lösenordsbyte (Rank based) */}
                      {hasEditPermission && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPasswordUserId(editingPasswordUserId === user.id ? null : user.id);
                            setNewPasswordVal('');
                          }}
                          className={`min-h-[34px] px-2.5 text-xs font-bold rounded-xl border flex items-center gap-1 cursor-pointer transition-colors ${
                            editingPasswordUserId === user.id
                              ? 'bg-orange-500 text-black border-orange-400 font-black'
                              : 'bg-[#1e1e1e] hover:bg-[#282828] text-slate-300 hover:text-white border-[#333]'
                          }`}
                          title="Ändra lösenord snabbt"
                        >
                          <Key className="w-3.5 h-3.5 text-orange-400" />
                          <span>Lösenord</span>
                        </button>
                      )}

                      {/* Ändra roll (Admin only) */}
                      {isAdmin && (
                        <div className="flex items-center gap-0.5 bg-[#181818] p-0.5 rounded-xl border border-[#333]">
                          {(['STUDENT', 'TEACHER', 'ADMIN'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleChangeRole(user.id, r)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                user.role === r
                                  ? r === 'ADMIN'
                                    ? 'bg-purple-600 text-white font-black'
                                    : r === 'TEACHER'
                                    ? 'bg-amber-500 text-black font-black'
                                    : 'bg-orange-500 text-black font-black'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title={`Ändra roll till ${r}`}
                            >
                              {r === 'STUDENT' ? 'Elev' : r === 'TEACHER' ? 'Lärare' : 'Admin'}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Logga in som denna användare */}
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleSwitchUser(user)}
                          className="min-h-[34px] px-2.5 bg-[#202020] hover:bg-orange-500 hover:text-black text-slate-300 font-bold text-xs rounded-xl border border-[#383838] flex items-center gap-1 cursor-pointer transition-colors"
                          title="Växla till detta konto för test"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Testa konto</span>
                        </button>
                      )}

                      {/* Radera konto (Rank based) */}
                      {hasDeletePermission && (
                        (isCurrent || isRootAdmin) ? (
                          <span
                            className="min-h-[34px] px-2 rounded-xl bg-slate-900 border border-[#333] text-slate-500 flex items-center justify-center text-xs"
                            title="Aktivt konto kan ej raderas"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id, user.displayName)}
                            className="min-h-[34px] w-8 bg-[#1e1e1e] hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-xl border border-[#333] flex items-center justify-center cursor-pointer transition-colors"
                            title="Ta bort konto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Inline lösenordsbyte formulär */}
                  {editingPasswordUserId === user.id && (
                    <div className="w-full mt-3 pt-3 border-t border-[#262626] flex flex-col sm:flex-row items-center gap-2 animate-in fade-in">
                      <span className="text-xs text-orange-400 font-bold whitespace-nowrap">
                        Nytt lösenord för {user.displayName}:
                      </span>
                      <input
                        type="text"
                        value={newPasswordVal}
                        onChange={(e) => setNewPasswordVal(e.target.value)}
                        placeholder="Ange nytt lösenord..."
                        className="flex-1 min-h-[36px] px-3 bg-[#121212] border border-orange-500/50 rounded-xl text-xs text-white outline-none font-mono"
                        autoFocus
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleSavePassword(user.id)}
                          className="flex-1 sm:flex-none min-h-[36px] px-4 bg-orange-500 hover:bg-orange-400 text-black text-xs font-black rounded-xl cursor-pointer shadow-md transition-all"
                        >
                          Spara online
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPasswordUserId(null)}
                          className="flex-1 sm:flex-none min-h-[36px] px-3 bg-[#222] hover:bg-[#2c2c2c] text-slate-400 text-xs font-bold rounded-xl cursor-pointer transition-all"
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= EDIT USER MODAL ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg font-black text-white">
                  Redigera konto: {editingUser.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  För- och efternamn:
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-sm text-white font-bold outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  E-post eller Elev-ID / Användarnamn:
                </label>
                <input
                  type="text"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-sm text-white font-mono outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Lösenord (Lämna tomt för att behålla nuvarande):
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Lösenord..."
                  className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-sm text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Elevgrupp / Klass:
                </label>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-xs text-white font-semibold outline-none cursor-pointer"
                >
                  {STANDARD_STUDENT_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Egen anpassad grupp</option>
                </select>
                {editGroup === 'CUSTOM' && (
                  <input
                    type="text"
                    value={editCustomGroup}
                    onChange={(e) => setEditCustomGroup(e.target.value)}
                    placeholder="Skriv namnet på klassen/gruppen..."
                    className="w-full min-h-[40px] px-3 bg-[#101010] border border-orange-500/50 rounded-xl text-xs text-white mt-1 outline-none"
                  />
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Skola / Företag:
                </label>
                <input
                  type="text"
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-xs text-white outline-none"
                />
              </div>

              {/* Roll är endast redigerbar för ADMIN */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">
                  Roll:
                </label>
                {isAdmin ? (
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#333] focus:border-orange-500 rounded-xl text-xs text-white font-bold outline-none cursor-pointer"
                  >
                    <option value="STUDENT">Elev</option>
                    <option value="TEACHER">Lärare</option>
                    <option value="ADMIN">Skoladministratör</option>
                  </select>
                ) : (
                  <div className="w-full min-h-[44px] px-3.5 bg-[#121212] border border-[#262626] rounded-xl text-xs text-slate-400 flex items-center font-bold">
                    Elev (Låst för ändring av lärare)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-[#222] hover:bg-[#2c2c2c] text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-orange-500 hover:bg-orange-400 active:scale-95 text-black font-black text-xs rounded-xl cursor-pointer shadow-md shadow-orange-500/20"
                >
                  {isSavingEdit ? 'Sparar online...' : 'Spara ändringar i molnet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TEACHER EXERCISE CREATOR MODAL ================= */}
      <TeacherExerciseCreatorModal
        isOpen={isExerciseCreatorOpen}
        onClose={() => setIsExerciseCreatorOpen(false)}
        currentUser={currentUser}
        onStartExerciseProject={onStartExerciseProject}
      />
    </div>
  );
};
