function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">ClipForge</h1>
          <p className="text-gray-400">Professional Video Editor</p>
        </header>

        <main className="text-center">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">Welcome to ClipForge</h2>
            <p className="text-gray-300 mb-6">
              Your video editing journey starts here. Import videos, create
              amazing content, and export your masterpieces.
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
              Get Started
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
