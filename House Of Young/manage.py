import os
import sys
import dotenv

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'HOY.settings')
    try:
        dotenv.load_dotenv()
    except AttributeError:
        dotenv.read_dotenv()

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
