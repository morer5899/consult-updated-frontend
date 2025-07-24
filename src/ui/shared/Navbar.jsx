import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react'; 

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          <Link to="/">AiConsult</Link>
        </h1>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/" className="hover:text-indigo-400 transition">Home</Link>
          <Link to="/about" className="hover:text-indigo-400 transition">About</Link>
          <Link to="/features" className="hover:text-indigo-400 transition">Features</Link>
          <Link to="/login" className="hover:text-indigo-400 transition">Login</Link>
          <Link
            to="/register"
            className="ml-4 bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm transition"
          >
            Get Started
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden focus:outline-none"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {isOpen && (
        <div className="md:hidden px-6 pb-4">
          <nav className="flex flex-col gap-4">
            <Link to="/" onClick={() => setIsOpen(false)} className="hover:text-indigo-400 transition">Home</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="hover:text-indigo-400 transition">About</Link>
            <Link to="/features" onClick={() => setIsOpen(false)} className="hover:text-indigo-400 transition">Features</Link>
            <Link to="/login" onClick={() => setIsOpen(false)} className="hover:text-indigo-400 transition">Login</Link>
            <Link
              to="/register"
              onClick={() => setIsOpen(false)}
              className="bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm transition w-fit"
            >
              Get Started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
