import { FC, useMemo } from "react";

interface SwitchProps {
  className?: string;
  checked?: boolean;
  onToggle: (v: boolean) => void;
}

const Switch: FC<SwitchProps> = ({ className = "", checked, onToggle }) => {
  return (
    <div
      className={`${className} w-12 h-4 inline-flex items-center ${
        checked ? "bg-[#2185D0] justify-end" : "bg-gray-500 justify-start"
      } gap-2 rounded-lg cursor-pointer`}
      onClick={() => onToggle(!checked)}
    >
      <div className="w-[20px] h-[20px] bg-white rounded-full" />
    </div>
  );
};

export default Switch;
