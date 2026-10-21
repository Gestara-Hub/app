// Shim: pacotes de aulas vivem em ./billing (doc 12, fase 4).
export {
  acceptsPackages,
  hasPackageUsage,
  hasUsablePackage,
  packageCandidatesFor,
  packageRosterInfo,
  packagesService,
  syncLessonPackagesFromDb,
  syncPackageUsage,
  syncStudentPackagesFromDb,
  type PackageUsageChange,
} from "./billing";
