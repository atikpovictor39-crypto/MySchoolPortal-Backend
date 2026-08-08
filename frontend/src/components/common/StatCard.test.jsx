import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatCard from './StatCard';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard icon={<span>icon</span>} iconBg="bg-sky-500" label="Students" value={42} />);
    expect(screen.getByText('Students')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders an optional sublabel', () => {
    render(
      <StatCard icon={<span />} iconBg="bg-sky-500" label="Class Average" value="79.3%" sublabel="Term 1 Exam" />
    );
    expect(screen.getByText('Term 1 Exam')).toBeInTheDocument();
  });

  it('omits the sublabel paragraph when none is given', () => {
    const { container } = render(<StatCard icon={<span />} iconBg="bg-sky-500" label="Fees Owed" value="₵0.00" />);
    expect(container.querySelectorAll('p').length).toBe(2);
  });
});
