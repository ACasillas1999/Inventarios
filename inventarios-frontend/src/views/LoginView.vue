<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  error.value = ''

  if (!email.value || !password.value) {
    error.value = 'Por favor ingresa tu email y contrasena'
    return
  }

  loading.value = true

  try {
    await authStore.login(email.value, password.value)
    router.push('/conteos/dashboard')
  } catch (err) {
    console.error('Login error:', err)
    const apiMessage = (err as any)?.response?.data?.error
    error.value = apiMessage || 'Error al iniciar sesion. Verifica tus credenciales.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <section class="login-panel">
      <div class="login-header">
        <p class="eyebrow">Sistema</p>
        <h1>Iniciar sesion</h1>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-field">
          <label for="email">Usuario o correo</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="admin@inventarios.com"
            :disabled="loading"
            required
          />
        </div>

        <div class="form-field">
          <label for="password">Contrasena</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="********"
            :disabled="loading"
            required
          />
        </div>

        <div class="remember-row">
          <label class="remember" for="remember">
            <input id="remember" v-model="remember" type="checkbox" />
            <span>Recordarme</span>
          </label>

          
        </div>

        <button type="submit" class="btn-login" :disabled="loading">
          {{ loading ? 'Ingresando...' : 'Ingresar al Sistema' }}
        </button>
      </form>

      <div class="login-footer">
        <p>Sistema de Conteos e Inventarios Fisicos</p>
      </div>
    </section>

    <aside class="visual-panel" aria-hidden="true">
      <div class="visual-glow"></div>
      <img class="brand-hero" src="/meta.png" alt="" />
      <p class="visual-caption">Control centralizado de inventarios</p>
    </aside>
  </div>
</template>

<style scoped>
.login-shell {
  width: min(980px, 100%);
  min-height: min(640px, calc(100vh - 4rem));
  display: grid;
  grid-template-columns: minmax(280px, 370px) 1fr;
  border-radius: 26px;
  overflow: hidden;
  box-shadow:
    0 28px 60px rgba(15, 23, 42, 0.16),
    0 8px 20px rgba(15, 23, 42, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: #ffffff;
}

.login-panel {
  background: #ffffff;
  padding: clamp(1.2rem, 2.4vw, 1.9rem);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-header {
  margin-bottom: 1.15rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
}

.login-header h1 {
  margin: 0.2rem 0 0;
  font-size: clamp(1.35rem, 2.1vw, 1.7rem);
  color: #0f172a;
}

.error-message {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 0.6rem 0.8rem;
  border-radius: 12px;
  margin-bottom: 0.8rem;
  font-size: 0.9rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

label {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.95rem;
}

input[type='email'],
input[type='password'] {
  padding: 0.68rem 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.96rem;
  outline: none;
  background: #f8fafc;
}

input[type='email']:focus,
input[type='password']:focus {
  border-color: #2563eb;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.remember-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.2rem 0 0.95rem;
}

.remember {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: #334155;
  font-size: 0.9rem;
}

.remember input {
  width: 16px;
  height: 16px;
}

.btn-login {
  width: 100%;
  padding: 0.76rem 0.95rem;
  background: linear-gradient(135deg, #f97316, #ea580c);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
}

.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-link {
  border: none;
  background: transparent;
  color: #2563eb;
  font-weight: 700;
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0;
  white-space: nowrap;
}

.btn-link:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.login-footer {
  margin-top: 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}

.login-footer p {
  margin: 0;
}

.visual-panel {
  position: relative;
  background:
    radial-gradient(circle at 24% 24%, rgba(37, 99, 235, 0.14), transparent 36%),
    linear-gradient(165deg, #f8fafc 0%, #edf1f8 55%, #e2e8f0 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  padding: 2rem;
}

.visual-glow {
  position: absolute;
  width: clamp(180px, 28vw, 320px);
  height: clamp(180px, 28vw, 320px);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0));
  filter: blur(6px);
}

.brand-hero {
  position: relative;
  width: clamp(190px, 28vw, 360px);
  height: auto;
  border-radius: 18px;
  object-fit: contain;
  z-index: 1;
  filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.18));
}

.visual-caption {
  position: relative;
  z-index: 1;
  margin: 0;
  color: #334155;
  font-size: 0.95rem;
  font-weight: 600;
}

@media (max-width: 860px) {
  .login-shell {
    width: min(460px, 100%);
    min-height: 0;
    grid-template-columns: 1fr;
  }

  .visual-panel {
    order: -1;
    padding: 1.3rem 1rem 0.8rem;
    gap: 0.55rem;
  }

  .brand-hero {
    width: clamp(140px, 42vw, 210px);
  }

  .visual-caption {
    font-size: 0.84rem;
  }
}
</style>
