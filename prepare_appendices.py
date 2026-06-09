import os
import shutil

src_dir = "/Users/nedim/Desktop/myRepo/FYP/deneme1"
dest_dir = "/Users/nedim/Desktop/FYP_Appendices"

os.makedirs(dest_dir, exist_ok=True)

# A — Load Test Configuration
with open(f"{src_dir}/performance/loadtest.js", "r") as f:
    loadtest_content = f.read()

loadtest_note = """/*
 * APPENDIX A - Load Test Configuration
 * 
 * Note on Methodology:
 * 1. VU Journey: VUs simulate real users by authenticating, browsing products, and randomly commenting/buying.
 * 2. Think Time: Included 'sleep()' calls mimic realistic user delays (reading a page) rather than DDoS-ing the server.
 * 3. Seeded Users (50): 50 accounts were pre-seeded in the database to allow VUs to pick an account and authenticate 
 *    concurrently without colliding on registration locks or exhausting DB connections with inserts.
 * 4. Stages: The test scales from 50 (warmup) to 300 (steady load) and finally 500 VUs (stress peak) to identify 
 *    the breaking points of the monolith and microservices.
 */

"""
with open(f"{dest_dir}/Appendix_A_LoadTest.js", "w") as f:
    f.write(loadtest_note + loadtest_content)

# C — Chaos Engineering Raw Results
shutil.copy(f"{src_dir}/performance/results/results-chaos.json", f"{dest_dir}/Appendix_C_ChaosResults.json")

# E — Docker Compose Configuration (Abbreviated)
def abbreviate_yaml(filepath):
    with open(filepath, "r") as f:
        lines = f.readlines()
    # Keep only up to ~50 lines to show service definitions, ports, envs
    return "".join(lines[:50]) + "\n  # ... (abbreviated for length) ...\n"

with open(f"{dest_dir}/Appendix_E_DockerCompose_Microservices.yml", "w") as f:
    f.write(abbreviate_yaml(f"{src_dir}/microservices/docker-compose.yml"))

with open(f"{dest_dir}/Appendix_E_DockerCompose_Monolith.yml", "w") as f:
    f.write(abbreviate_yaml(f"{src_dir}/monolith/docker-compose.yml"))

# F — Circuit Breaker Implementation
shutil.copy(f"{src_dir}/microservices/api-gateway/src/utils/CircuitBreaker.ts", f"{dest_dir}/Appendix_F_CircuitBreaker.ts")

# G — API Gateway Auth Middleware
shutil.copy(f"{src_dir}/microservices/api-gateway/src/middleware/authMiddleware.ts", f"{dest_dir}/Appendix_G_AuthMiddleware.ts")

# H — RabbitMQ Dead Letter Queue Configuration
# Extract snippet
with open(f"{src_dir}/microservices/services/product-service/src/utils/messageBroker.ts", "r") as f:
    broker_content = f.read()

snippet = """/*
 * APPENDIX H - RabbitMQ DLQ Configuration
 * This snippet shows the queue declaration linking to the dead-letter-exchange.
 */

"""
# We'll just search for the connectToRabbitMQ block and grab it roughly
start_idx = broker_content.find("channel.assertQueue('comment_created_queue'")
if start_idx == -1:
    start_idx = broker_content.find("x-dead-letter-exchange") - 100
end_idx = broker_content.find("})", start_idx) + 2
dlq_code = broker_content[start_idx:end_idx] if start_idx != -1 else "DLQ config found inside messageBroker.ts"

with open(f"{dest_dir}/Appendix_H_RabbitMQ_DLQ.ts", "w") as f:
    f.write(snippet + dlq_code + "\n")

# I — Observability Stack Configuration
shutil.copy(f"{src_dir}/performance/grafana/dashboards/architectural_contrast.json", f"{dest_dir}/Appendix_I_GrafanaDashboard.json")
shutil.copy(f"{src_dir}/microservices/telegraf/telegraf.conf", f"{dest_dir}/Appendix_I_Telegraf.conf")

# J — Seed Data Script
with open(f"{src_dir}/microservices/services/auth-service/src/seedUsers.ts", "r") as f:
    seed_content = f.read()

seed_note = """/*
 * APPENDIX J - Seed Data Script
 * 
 * Note on Seeding: 50 accounts were pre-created so that during the load test, up to 500 VUs 
 * could cycle through these 50 valid credentials. This ensures the authentication endpoints 
 * are tested with real DB lookups and bcrypt validations without requiring complex registration 
 * steps in the k6 journey.
 */

"""
with open(f"{dest_dir}/Appendix_J_SeedUsers.ts", "w") as f:
    f.write(seed_note + seed_content)

print("Appendices prepared successfully.")
