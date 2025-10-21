import { createSignal, createEffect, For, Show, JSX } from "solid-js";
import {
  FormProps,
  FormTextFieldProps,
  FormTextAreaProps,
  FormDropdownProps,
  FormDropdownItemProps,
  FormDropdownSectionProps,
  FormDescriptionProps,
  FormLinkAccessoryProps,
  FormValues,
  ImageLike,
} from "../types";

// ============================================================================
// Form Component
// ============================================================================

export function Form(props: FormProps): JSX.Element {
  const [formValues, setFormValues] = createSignal<FormValues>({});
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    if (props.onSubmit && !isSubmitting()) {
      setIsSubmitting(true);
      try {
        await props.onSubmit(formValues());
      } catch (error) {
        console.error("Form submission error:", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const updateFormValue = (id: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div class="raycast-form h-full bg-white dark:bg-gray-900">
      {/* Navigation Title */}
      <Show when={props.navigationTitle}>
        <div class="raycast-form-header border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {props.navigationTitle}
          </h1>
        </div>
      </Show>

      <form
        class="raycast-form-content flex-1 space-y-6 overflow-y-auto p-6"
        onSubmit={handleSubmit}
        noValidate
      >
        {/* Form Fields */}
        <div class="raycast-form-fields space-y-4">{props.children}</div>

        {/* Actions */}
        <Show when={props.actions}>
          <div class="raycast-form-actions border-t border-gray-200 pt-6 dark:border-gray-700">
            {props.actions}
          </div>
        </Show>
      </form>

      {/* Loading Overlay */}
      <Show when={isSubmitting()}>
        <div class="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
          <div class="text-center">
            <div class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Submitting...
            </p>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Form TextField Component
// ============================================================================

export function FormTextField(props: FormTextFieldProps): JSX.Element {
  const [value, setValue] = createSignal(
    props.value || props.defaultValue || "",
  );
  const [isFocused, setIsFocused] = createSignal(false);
  const [hasError, setHasError] = createSignal(!!props.error);

  createEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
  });

  createEffect(() => {
    setHasError(!!props.error);
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    setValue(newValue);
    props.onChange?.(newValue);

    // Clear error on input
    if (hasError()) {
      setHasError(false);
    }
  };

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    props.onFocus?.(e as any);
  };

  const handleBlur = (e: FocusEvent) => {
    setIsFocused(false);
    props.onBlur?.(e as any);
  };

  return (
    <div class="raycast-form-textfield">
      {/* Label */}
      <Show when={props.title}>
        <label
          for={props.id}
          class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {props.title}
          {props.required && <span class="ml-1 text-red-500">*</span>}
        </label>
      </Show>

      {/* Input */}
      <div class="relative">
        <input
          id={props.id}
          name={props.id}
          type="text"
          value={value()}
          placeholder={props.placeholder}
          required={props.required}
          class={`w-full rounded-md border bg-white px-3 py-2 text-gray-900 transition-colors focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 ${
            hasError()
              ? "border-red-300 focus:ring-red-500 dark:border-red-600"
              : isFocused()
                ? "border-blue-300 focus:ring-blue-500 dark:border-blue-600"
                : "border-gray-300 dark:border-gray-600"
          } `}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {/* Focus indicator */}
        <Show when={isFocused()}>
          <div class="ring-opacity-50 pointer-events-none absolute inset-0 rounded-md ring-2 ring-blue-500"></div>
        </Show>
      </div>

      {/* Error Message */}
      <Show when={props.error}>
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">{props.error}</p>
      </Show>

      {/* Info Message */}
      <Show when={props.info && !props.error}>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {props.info}
        </p>
      </Show>
    </div>
  );
}

// ============================================================================
// Form TextArea Component
// ============================================================================

export function FormTextArea(props: FormTextAreaProps): JSX.Element {
  const [value, setValue] = createSignal(
    props.value || props.defaultValue || "",
  );
  const [isFocused, setIsFocused] = createSignal(false);
  const [hasError, setHasError] = createSignal(!!props.error);

  createEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value);
    }
  });

  createEffect(() => {
    setHasError(!!props.error);
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    const newValue = target.value;
    setValue(newValue);
    props.onChange?.(newValue);

    // Clear error on input
    if (hasError()) {
      setHasError(false);
    }
  };

  const handleFocus = (e: FocusEvent) => {
    setIsFocused(true);
    props.onFocus?.(e as any);
  };

  const handleBlur = (e: FocusEvent) => {
    setIsFocused(false);
    props.onBlur?.(e as any);
  };

  return (
    <div class="raycast-form-textarea">
      {/* Label */}
      <Show when={props.title}>
        <label
          for={props.id}
          class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {props.title}
          {props.required && <span class="ml-1 text-red-500">*</span>}
        </label>
      </Show>

      {/* TextArea */}
      <div class="relative">
        <textarea
          id={props.id}
          name={props.id}
          value={value()}
          placeholder={props.placeholder}
          required={props.required}
          rows={4}
          class={`resize-vertical w-full rounded-md border bg-white px-3 py-2 text-gray-900 transition-colors focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 ${
            hasError()
              ? "border-red-300 focus:ring-red-500 dark:border-red-600"
              : isFocused()
                ? "border-blue-300 focus:ring-blue-500 dark:border-blue-600"
                : "border-gray-300 dark:border-gray-600"
          } `}
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {/* Focus indicator */}
        <Show when={isFocused()}>
          <div class="ring-opacity-50 pointer-events-none absolute inset-0 rounded-md ring-2 ring-blue-500"></div>
        </Show>
      </div>

      {/* Markdown Preview */}
      <Show when={props.enableMarkdown && value()}>
        <div class="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
          <div class="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            Preview:
          </div>
          <div class="prose dark:prose-invert prose-sm max-w-none">
            <MarkdownPreview content={value()} />
          </div>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={props.error}>
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">{props.error}</p>
      </Show>

      {/* Info Message */}
      <Show when={props.info && !props.error}>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {props.info}
        </p>
      </Show>
    </div>
  );
}

// ============================================================================
// Form Dropdown Component
// ============================================================================

export function FormDropdown(props: FormDropdownProps): JSX.Element {
  const [selectedValue, setSelectedValue] = createSignal(
    props.value || props.defaultValue || "",
  );
  const [isOpen, setIsOpen] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);
  const [hasError, setHasError] = createSignal(!!props.error);

  createEffect(() => {
    if (props.value !== undefined) {
      setSelectedValue(props.value);
    }
  });

  createEffect(() => {
    setHasError(!!props.error);
  });

  const handleChange = (value: string) => {
    setSelectedValue(value);
    props.onChange?.(value);
    setIsOpen(false);

    // Clear error on change
    if (hasError()) {
      setHasError(false);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Close dropdown after a short delay to allow for clicks
    setTimeout(() => setIsOpen(false), 150);
  };

  return (
    <div class="raycast-form-dropdown">
      {/* Label */}
      <Show when={props.title}>
        <label
          for={props.id}
          class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {props.title}
          {props.required && <span class="ml-1 text-red-500">*</span>}
        </label>
      </Show>

      {/* Dropdown */}
      <div class="relative">
        <button
          type="button"
          id={props.id}
          class={`w-full rounded-md border bg-white px-3 py-2 text-left text-gray-900 transition-colors focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-gray-100 ${
            hasError()
              ? "border-red-300 focus:ring-red-500 dark:border-red-600"
              : isFocused()
                ? "border-blue-300 focus:ring-blue-500 dark:border-blue-600"
                : "border-gray-300 dark:border-gray-600"
          } `}
          onClick={() => setIsOpen(!isOpen())}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <span class="block truncate">
            {selectedValue() || props.placeholder || "Select an option..."}
          </span>
          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              class={`h-5 w-5 text-gray-400 transition-transform ${isOpen() ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>

        {/* Dropdown Menu */}
        <Show when={isOpen()}>
          <div class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
            <div class="py-1">{props.children}</div>
          </div>
        </Show>

        {/* Hidden select for form submission */}
        <select
          name={props.id}
          value={selectedValue()}
          class="sr-only"
          tabIndex={-1}
          required={props.required}
        >
          <option value="">{props.placeholder || "Select an option..."}</option>
          {/* Options would be populated by children */}
        </select>
      </div>

      {/* Error Message */}
      <Show when={props.error}>
        <p class="mt-1 text-sm text-red-600 dark:text-red-400">{props.error}</p>
      </Show>

      {/* Info Message */}
      <Show when={props.info && !props.error}>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {props.info}
        </p>
      </Show>
    </div>
  );
}

// ============================================================================
// Form Dropdown Item Component
// ============================================================================

export function FormDropdownItem(props: FormDropdownItemProps): JSX.Element {
  const handleClick = () => {
    // This would be handled by the parent dropdown
    console.log("Dropdown item selected:", props.value);
  };

  return (
    <button
      type="button"
      class="raycast-form-dropdown-item flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={handleClick}
      value={props.value}
    >
      <Show when={props.icon}>
        <div class="mr-3 flex-shrink-0">
          <ImageComponent image={props.icon!} class="h-4 w-4" />
        </div>
      </Show>
      <span class="truncate text-gray-900 dark:text-gray-100">
        {props.title}
      </span>
    </button>
  );
}

// ============================================================================
// Form Dropdown Section Component
// ============================================================================

export function FormDropdownSection(
  props: FormDropdownSectionProps,
): JSX.Element {
  return (
    <div class="raycast-form-dropdown-section">
      <Show when={props.title}>
        <div class="bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:bg-gray-700 dark:text-gray-400">
          {props.title}
        </div>
      </Show>
      <div class="raycast-form-dropdown-section-content">{props.children}</div>
    </div>
  );
}

// ============================================================================
// Form Description Component
// ============================================================================

export function FormDescription(props: FormDescriptionProps): JSX.Element {
  return (
    <div class="raycast-form-description">
      <Show when={props.title}>
        <h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          {props.title}
        </h3>
      </Show>
      <p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
        {props.text}
      </p>
    </div>
  );
}

// ============================================================================
// Form Link Accessory Component
// ============================================================================

export function FormLinkAccessory(props: FormLinkAccessoryProps): JSX.Element {
  return (
    <a
      href={props.target}
      target="_blank"
      rel="noopener noreferrer"
      class="raycast-form-link-accessory inline-flex items-center text-sm text-blue-600 hover:underline dark:text-blue-400"
    >
      {props.text}
      <svg
        class="ml-1 h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function MarkdownPreview(props: { content: string }): JSX.Element {
  // Simple markdown preview
  const parseMarkdown = (content: string): string => {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /`([^`]+)`/g,
        '<code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">$1</code>',
      )
      .replace(/\n/g, "<br>");
  };

  return <div innerHTML={parseMarkdown(props.content)} />;
}

function ImageComponent(props: {
  image: ImageLike;
  class?: string;
}): JSX.Element {
  const getImageSrc = (image: ImageLike): string => {
    if (typeof image === "string") {
      return image;
    }

    if (typeof image === "object" && image !== null) {
      if ("source" in image) {
        if (typeof image.source === "string") {
          return image.source;
        }
        // Handle themeable source
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        return isDark
          ? (image.source as any).dark
          : (image.source as any).light;
      }

      if ("fileIcon" in image) {
        return getFileIcon(image.fileIcon);
      }
    }

    return "";
  };

  const src = getImageSrc(props.image);

  // Check if it's an emoji
  if (
    src.length <= 4 &&
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/u.test(
      src,
    )
  ) {
    return <span class={`raycast-icon-emoji ${props.class || ""}`}>{src}</span>;
  }

  // Regular image
  return (
    <img src={src} alt="" class={`raycast-icon-image ${props.class || ""}`} />
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFileIcon(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();

  const iconMap: Record<string, string> = {
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    xls: "📊",
    xlsx: "📊",
    ppt: "📽️",
    pptx: "📽️",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    mp4: "🎬",
    mov: "🎬",
    avi: "🎬",
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    zip: "🗜️",
    rar: "🗜️",
    "7z": "🗜️",
  };

  return iconMap[extension || ""] || "📄";
}

// ============================================================================
// Form Validation Utilities
// ============================================================================

export class FormValidator {
  static validateRequired(value: any, fieldName: string): string | null {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      return `${fieldName} is required`;
    }
    return null;
  }

  static validateEmail(email: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return null;
  }

  static validateUrl(url: string): string | null {
    try {
      new URL(url);
      return null;
    } catch {
      return "Please enter a valid URL";
    }
  }

  static validateMinLength(value: string, minLength: number): string | null {
    if (value.length < minLength) {
      return `Must be at least ${minLength} characters long`;
    }
    return null;
  }

  static validateMaxLength(value: string, maxLength: number): string | null {
    if (value.length > maxLength) {
      return `Must be no more than ${maxLength} characters long`;
    }
    return null;
  }
}

