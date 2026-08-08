import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

// Drop-in replacement for <input type="password">: forwards every prop
// through, just adds a show/hide toggle. tabIndex={-1} on the button keeps
// Tab from stopping on it, so keyboard flow through the form is unchanged.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-9`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
