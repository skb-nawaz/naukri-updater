// Jenkins Declarative Pipeline — Naukri Updater
// Runs the full Playwright suite every 2 hours, headless.
//
// ── One-time Jenkins setup ─────────────────────────────────────────────
// 1. Agent needs Node.js 20+ on PATH (verify: node --version).
//    Option A (recommended): install "NodeJS" plugin → Manage Jenkins →
//    Tools → NodeJS installations → name it "Node_20" → uncomment the
//    `tools` block below.
// 2. Add these 3 Secret-Text credentials (Dashboard → Manage Jenkins →
//    Credentials → global → Add credentials, Kind: Secret text):
//      naukri-encryption-key       = value of ENCRYPTION_KEY from your .env
//      naukri-email-encrypted      = value of NAUKRI_EMAIL_ENCRYPTED
//      naukri-password-encrypted   = value of NAUKRI_PASSWORD_ENCRYPTED
//    Get the values with:  npm run encrypt:creds  (then copy from .env)
// 3. New Item → Pipeline → "Pipeline script from SCM" → Git →
//    Repository URL: https://github.com/skb-nawaz/naukri-updater.git
//    Script Path: Jenkinsfile
//    (Polling NOT needed — the cron trigger below schedules every 2h.)
//
// ── Session renewal (when a build fails with CAPTCHA) ──────────────────
// Unattended runs never solve the CAPTCHA: they reuse auth/naukri-auth.json.
// When it expires, refresh it ONCE on this machine (headed, solve CAPTCHA):
//    npm run login
// The "Sync session" stage below copies it into the Jenkins workspace, so
// the next build is green again.
// ───────────────────────────────────────────────────────────────────────

pipeline {
  agent any

  // Every 2 hours (hashed minute spreads load on Jenkins controllers)
  triggers {
    cron('H H/2 * * *')
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    disableConcurrentBuilds() // Naukri blocks parallel logins on same account
  }

  // tools {
  //   nodejs 'Node_20' // uncomment after configuring NodeJS tool (see header)
  // }

  environment {
    HEADLESS = 'true' // Jenkins has no display — always headless
    CI = 'true'       // 1 retry + forbid .only in test runs
    // Secrets — never commit .env; Jenkins injects these per build
    ENCRYPTION_KEY            = credentials('naukri-encryption-key')
    NAUKRI_EMAIL_ENCRYPTED    = credentials('naukri-email-encrypted')
    NAUKRI_PASSWORD_ENCRYPTED = credentials('naukri-password-encrypted')
    // Local repo on this same machine — source of the reusable Naukri session
    LOCAL_REPO = 'E:\\Automation\\naukri_updater'
  }

  stages {
    stage('Node version') {
      steps {
        script {
          if (isUnix()) {
            sh 'node --version && npm --version'
          } else {
            bat 'node --version && npm --version'
          }
        }
      }
    }

    stage('Install deps') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci'
          } else {
            bat 'npm ci'
          }
        }
      }
    }

    stage('Install browsers') {
      steps {
        script {
          if (isUnix()) {
            // --with-deps installs OS libs (needs sudo on the agent)
            sh 'npx playwright install --with-deps chromium || npx playwright install chromium'
          } else {
            bat 'npx playwright install chromium'
          }
        }
      }
    }

    stage('Sync session') {
      steps {
        script {
          // Fresh session file from the local repo (refreshed by `npm run login`)
          // keeps unattended runs off the CAPTCHA/OTP fresh-login flow.
          if (isUnix()) {
            sh '''
              if [ -f "$LOCAL_REPO/auth/naukri-auth.json" ]; then
                mkdir -p auth && cp -f "$LOCAL_REPO/auth/naukri-auth.json" auth/naukri-auth.json
                echo "Synced session from $LOCAL_REPO"
              else
                echo "No session at $LOCAL_REPO/auth/naukri-auth.json — tests will attempt a fresh login."
              fi
            '''
          } else {
            bat '''
              if exist "%LOCAL_REPO%\\auth\\naukri-auth.json" (
                if not exist auth mkdir auth
                copy /Y "%LOCAL_REPO%\\auth\\naukri-auth.json" "auth\\naukri-auth.json" >nul
                echo Synced session from %LOCAL_REPO%
              ) else (
                echo No session at %LOCAL_REPO%\\auth\\naukri-auth.json — tests will attempt a fresh login.
              )
            '''
          }
        }
      }
    }

    stage('Typecheck') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm run typecheck'
          } else {
            bat 'npm run typecheck'
          }
        }
      }
    }

    stage('Run suite') {
      steps {
        script {
          if (isUnix()) {
            sh 'npx playwright test'
          } else {
            bat 'npx playwright test'
          }
        }
      }
    }
  }

  post {
    always {
      // Keep screenshots / traces / HTML report for debugging failures
      archiveArtifacts artifacts: 'test-results/**, playwright-report/**', allowEmptyArchive: true
    }
    failure {
      echo 'Suite failed — check archived test-results/ screenshots and the console log. CAPTCHA/OTP blocks need a manual headed run: npm run login (HEADLESS=false).'
    }
  }
}
