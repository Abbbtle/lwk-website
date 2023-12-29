import React from 'react'

const Navbar = () => {
  return (
    <nav className="bg-blue-500 p-4">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo or Brand */}
        <a href="#" className="text-white text-xl font-bold">Your Logo</a>

        {/* Navbar Links */}
        <div className="hidden md:flex space-x-4">
          <a href="#" className="text-white">Home</a>
          <a href="#" className="text-white">About</a>
          <a href="#" className="text-white">Services</a>
          <a href="#" className="text-white">Contact</a>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button className="text-white">
            {/* Add your mobile menu icon here */}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar