"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ClarificationQuestion } from "@/features/api/client";

interface ClarificationBubbleProps {
  clarification: ClarificationQuestion;
  onAnswer: (answer: string) => void;
  onDecline: () => void;
}

export default function ClarificationBubble({
  clarification,
  onAnswer,
  onDecline,
}: ClarificationBubbleProps) {
  const { question, options, allow_multiple } = clarification;
  const hasOptions = options.length > 0;

  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    new Set()
  );
  const [freeformText, setFreeformText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const checkboxGroupRef = useRef<HTMLDivElement>(null);

  // Auto-focus the primary interactive control on mount
  useEffect(() => {
    // Small delay to ensure the element is rendered and scrolled into view
    const timer = setTimeout(() => {
      if (!hasOptions && inputRef.current) {
        inputRef.current.focus();
      } else if (hasOptions && !allow_multiple && radioGroupRef.current) {
        const firstRadio = radioGroupRef.current.querySelector<HTMLButtonElement>('[role="radio"]');
        firstRadio?.focus();
      } else if (hasOptions && allow_multiple && checkboxGroupRef.current) {
        const firstCheckbox = checkboxGroupRef.current.querySelector<HTMLButtonElement>('[role="checkbox"]');
        firstCheckbox?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [hasOptions, allow_multiple]);

  const handleToggleCheckbox = (option: string) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  };

  const handleContinue = () => {
    let answer: string;
    if (hasOptions && allow_multiple) {
      answer = Array.from(selectedOptions).join(", ");
    } else if (hasOptions) {
      answer = selectedOption;
    } else {
      answer = freeformText.trim();
    }
    if (!answer) return;
    onAnswer(answer);
  };

  const canContinue = hasOptions
    ? allow_multiple
      ? selectedOptions.size > 0
      : selectedOption !== ""
    : freeformText.trim() !== "";

  return (
    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
      <div className="flex items-start gap-2 mb-3">
        <HelpCircle className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
          {question}
        </span>
      </div>

      {/* Options: radio or checkbox */}
      {hasOptions && !allow_multiple && (
        <RadioGroup
          ref={radioGroupRef}
          value={selectedOption}
          onValueChange={setSelectedOption}
          className="gap-2 pl-6 mb-3"
        >
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <RadioGroupItem value={option} id={`opt-${option}`} />
              <Label
                htmlFor={`opt-${option}`}
                className="text-xs cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {hasOptions && allow_multiple && (
        <div ref={checkboxGroupRef} className="space-y-2 pl-6 mb-3">
          {options.map((option) => (
            <div key={option} className="flex items-center gap-2">
              <Checkbox
                id={`chk-${option}`}
                checked={selectedOptions.has(option)}
                onCheckedChange={() => handleToggleCheckbox(option)}
              />
              <Label
                htmlFor={`chk-${option}`}
                className="text-xs cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      )}

      {/* Freeform text input when no options */}
      {!hasOptions && (
        <div className="pl-6 mb-3">
          <Input
            ref={inputRef}
            value={freeformText}
            onChange={(e) => setFreeformText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canContinue) {
                e.preventDefault();
                handleContinue();
              }
            }}
            placeholder="Type your answer..."
            className="text-xs h-8"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pl-6">
        <Button
          size="sm"
          onClick={handleContinue}
          disabled={!canContinue}
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          Continue
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDecline}
          className="h-7 text-xs"
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
