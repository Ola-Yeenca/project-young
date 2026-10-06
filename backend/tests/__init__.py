import logging

# Expected errors (a simulated mail outage, rejected spam) would otherwise flood test output.
logging.disable(logging.CRITICAL)
