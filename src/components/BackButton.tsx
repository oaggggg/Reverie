import { ArrowLeft } from "lucide-react";
import { usePlayerStore } from "../store/playerStore";

export default function BackButton({ onClick }: { onClick?: () => void }) {
  const goBack = usePlayerStore((s) => s.goBack);
  return (
    <button
      className="btn detail-back"
      onClick={onClick ?? goBack}
      title="返回"
    >
      <ArrowLeft size={14} /> 返回
    </button>
  );
}
