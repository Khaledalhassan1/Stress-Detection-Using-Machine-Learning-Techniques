import { StressLevelType } from "@/types/employee";

interface StressBadgeProps {
  level: StressLevelType;
}

const StressBadge = ({ level }: StressBadgeProps) => {
  const getStressClass = () => {
    switch (level) {
      case "Stress":
        // تقدر تخصص ألوان الـ CSS على كيفك
        return "stress-badge stress-badge-high"; // مثلاً أحمر
      case "Not Stress":
        return "stress-badge stress-badge-low"; // مثلاً أخضر
      case "Not Measured Yet":
      default:
        return "stress-badge bg-muted text-muted-foreground"; // رمادي
    }
  };

  const getStressText = () => {
    switch (level) {
      case "Stress":
        return "Stress";
      case "Not Stress":
        return "Not Stress";
      case "Not Measured Yet":
      default:
        return "Not Measured Yet";
    }
  };

  return <span className={getStressClass()}>{getStressText()}</span>;
};

export default StressBadge;
