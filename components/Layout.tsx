import React from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'


const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Navbar />
        <main className="flex-1 p-4 bg-gray-100 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

export default Layout