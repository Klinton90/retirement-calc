import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../components/pages/Dashboard/Dashboard';

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Clear localStorage before tests
    localStorage.clear();
  });

  it('renders RetireSmart Canada title', () => {
    render(<Dashboard />);
    const titleElements = screen.getAllByText(/RetireSmart/i);
    expect(titleElements.length).toBeGreaterThan(0);
  });

  it('renders core dashboard layout structures', () => {
    render(<Dashboard />);
    
    // Check for panel titles or sections using exact matching
    expect(screen.getByText("HE'S FINANCIALS (Primary)")).toBeInTheDocument();
    expect(screen.getByText("SHE'S FINANCIALS (Partner)")).toBeInTheDocument();
    expect(screen.getByText("EXTENSIBLE LIFE FACTORS")).toBeInTheDocument();
    expect(screen.getByText(/PORTFOLIO PROJECTION/i)).toBeInTheDocument();
  });
});
