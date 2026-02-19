import { useState } from 'react'
import './App.css'

function App() {
  const [githubUrl, setGithubUrl] = useState('')
  const [teamName, setTeamName] = useState('TEAM')
  const [leaderName, setLeaderName] = useState('LEAD')
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const [cloneResult, setCloneResult] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [healingProgress, setHealingProgress] = useState([])
  const [isHealing, setIsHealing] = useState(false)
  const [finalStatus, setFinalStatus] = useState(null)

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }])
  }

  const startWorkflow = async () => {
    // Reset state
    setLogs([])
    setCloneResult(null)
    setTestResult(null)
    setHealingProgress([])
    setFinalStatus(null)
    setLoading(true)
    setIsHealing(false)

    try {
      // STEP 1: Clone Repository
      addLog('🚀 Cloning repository...', 'info')
      const cloneResponse = await fetch('/api/docker/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl, teamName, leaderName })
      })

      if (!cloneResponse.ok) {
        throw new Error('Failed to clone repository')
      }

      const cloneData = await cloneResponse.json()
      setCloneResult(cloneData)
      addLog(`✅ Repository cloned: ${cloneData.containerName}`, 'success')
      addLog(`📁 Working directory: ${cloneData.workDir}`, 'info')

      // STEP 2: Check test results
      if (cloneData.tests) {
        setTestResult(cloneData.tests)
        addLog(`📋 Test Config: ${cloneData.tests.configFile}`, 'info')
        addLog(`🧪 Test Command: ${cloneData.tests.testCommand}`, 'info')
        addLog(`Exit Code: ${cloneData.tests.exitCode}`, cloneData.tests.exitCode === 0 ? 'success' : 'error')

        // STEP 3: Auto-healing if tests failed
        if (cloneData.tests.exitCode !== 0) {
          addLog('⚠️  Tests failed! Starting auto-healing workflow...', 'warning')
          await startHealingLoop(cloneData.containerName, cloneData.workDir, cloneData.tests.logFile)
        } else {
          addLog('🎉 All tests passed! No healing needed.', 'success')
          setFinalStatus('success')
          setLoading(false)
        }
      } else {
        addLog('⚠️  No tests configured in this repository', 'warning')
        setFinalStatus('no-tests')
        setLoading(false)
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error')
      setLoading(false)
    }
  }

  const startHealingLoop = async (containerName, workDir, logFile) => {
    setIsHealing(true)
    const maxIterations = 5
    let iteration = 1
    let testsPassed = false

    while (!testsPassed && iteration <= maxIterations) {
      addLog(`\n🔄 HEALING ITERATION ${iteration}/${maxIterations}`, 'info')
      
      try {
        // Get test log
        addLog('📖 Reading test log...', 'info')
        const logResponse = await fetch(`/api/test-runner/logs/${logFile}`)
        const logData = await logResponse.json()

        // Call healing API
        addLog('🤖 Analyzing failures with AI agents...', 'info')
        const healResponse = await fetch('/api/healing/heal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testLogs: logData.content,
            options: {
              reportFormat: 'json',
              autoApply: true,
              containerName,
              workDir,
              commitMessage: `AI Fix Iteration ${iteration} - Auto-healing test failures`
            }
          })
        })

        const healData = await healResponse.json()
        
        setHealingProgress(prev => [...prev, {
          iteration,
          statistics: healData.statistics,
          fixesApplied: healData.fixesApplied
        }])

        addLog(`✅ Healing completed!`, 'success')
        addLog(`  • Total Failures: ${healData.statistics.totalFailures}`, 'info')
        addLog(`  • Fixes Generated: ${healData.statistics.patched}`, 'info')
        addLog(`  • Fixes Approved: ${healData.statistics.approved}`, 'info')
        addLog(`  • Approval Rate: ${healData.statistics.approvalRate}`, 'info')

        if (healData.fixesApplied) {
          addLog('✅ Fixes applied to code!', 'success')
          
          // Re-run tests
          addLog('🔄 Re-running tests...', 'info')
          const retestResponse = await fetch(`/api/test-runner/${containerName}/run-tests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workDir })
          })

          const retestData = await retestResponse.json()
          logFile = retestData.logFile

          addLog(`Exit Code: ${retestData.output.exitCode}`, retestData.output.exitCode === 0 ? 'success' : 'warning')

          if (retestData.output.exitCode === 0) {
            addLog(`\n🎉 SUCCESS! All tests are now passing!`, 'success')
            addLog(`Total iterations: ${iteration}`, 'success')
            testsPassed = true
            setFinalStatus('healed')
          } else {
            addLog('⚠️  Some tests still failing. Next iteration...', 'warning')
            iteration++
          }
        } else {
          addLog('❌ No fixes could be applied', 'error')
          setFinalStatus('failed')
          break
        }
      } catch (error) {
        addLog(`❌ Healing error: ${error.message}`, 'error')
        setFinalStatus('error')
        break
      }
    }

    if (!testsPassed) {
      addLog(`\n⚠️  Max iterations reached or healing failed`, 'warning')
      setFinalStatus('partial')
    }

    setIsHealing(false)
    setLoading(false)
  }

  const getLogIcon = (type) => {
    switch(type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '•'
    }
  }

  const getFinalStatusMessage = () => {
    switch(finalStatus) {
      case 'success': return '🎉 All tests passed on first run!'
      case 'healed': return '✨ Tests healed successfully!'
      case 'failed': return '❌ Healing failed'
      case 'partial': return '⚠️  Partially healed - some tests may still fail'
      case 'no-tests': return 'ℹ️  No tests configured'
      case 'error': return '❌ Error occurred'
      default: return ''
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🤖 RIFT Transformers</h1>
        <p className="subtitle">AI-Powered Test Healing System</p>
      </header>

      <div className="main-content">
        <div className="input-section">
          <div className="form-group">
            <label>GitHub Repository URL</label>
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Team Name</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="TEAM"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Leader Name</label>
              <input
                type="text"
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                placeholder="LEAD"
                disabled={loading}
              />
            </div>
          </div>

          <button
            className="start-button"
            onClick={startWorkflow}
            disabled={loading || !githubUrl}
          >
            {loading ? '🔄 Processing...' : '🚀 Start Auto-Healing Workflow'}
          </button>
        </div>

        {logs.length > 0 && (
          <div className="logs-section">
            <h2>📋 Execution Log</h2>
            <div className="logs-container">
              {logs.map((log, idx) => (
                <div key={idx} className={`log-entry log-${log.type}`}>
                  <span className="log-icon">{getLogIcon(log.type)}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {healingProgress.length > 0 && (
          <div className="healing-section">
            <h2>🔧 Healing Progress</h2>
            {healingProgress.map((progress, idx) => (
              <div key={idx} className="healing-card">
                <h3>Iteration {progress.iteration}</h3>
                <div className="stats-grid">
                  <div className="stat">
                    <span className="stat-label">Total Failures:</span>
                    <span className="stat-value">{progress.statistics.totalFailures}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Fixes Generated:</span>
                    <span className="stat-value">{progress.statistics.patched}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Fixes Approved:</span>
                    <span className="stat-value">{progress.statistics.approved}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Approval Rate:</span>
                    <span className="stat-value">{progress.statistics.approvalRate}</span>
                  </div>
                </div>
                <div className={`status-badge ${progress.fixesApplied ? 'success' : 'warning'}`}>
                  {progress.fixesApplied ? '✅ Fixes Applied' : '⚠️  No Fixes Applied'}
                </div>
              </div>
            ))}
          </div>
        )}

        {finalStatus && (
          <div className={`final-status status-${finalStatus}`}>
            <h2>{getFinalStatusMessage()}</h2>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
