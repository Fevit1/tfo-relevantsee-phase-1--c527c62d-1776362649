'use client'

import { useState, useRef } from 'react'

export function TagInput({ value = [], onChange, placeholder = 'Type and press Enter', maxItems, disabled }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
      e.preventDefault()
      const newTag = inputValue.trim()
      if (!value.includes(newTag)) {
        if (maxItems && value.length >= maxItems) return
        onChange([...value, newTag])
      }
      setInputValue('')
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const removeTag = (tag) => {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[42px] w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 cursor-text focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-900 text-indigo-200 text-xs rounded-md border border-indigo-700"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
              className="text-indigo-400 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (!maxItems || value.length < maxItems) && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
      )}
    </div>
  )
}