'use client';

interface SegOption<T extends string> {
  value: T;
  label: string;
}

interface SegProps<T extends string> {
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Seg<T extends string>({ options, value, onChange, className = '' }: SegProps<T>) {
  return (
    <div className={`inline-flex bg-[#f9f7f6] border border-[#e9e3df] rounded-full p-[3px] ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-[14px] py-[6px] rounded-full text-[12px] font-semibold transition-all duration-150
            ${value === opt.value
              ? 'bg-[#403833] text-white'
              : 'bg-transparent text-[#7b7571] hover:text-[#403833]'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
