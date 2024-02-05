from django.test import TestCase
from core.models import Event


app_name = 'core'

class TestModel(TestCase):
    def test_event(self):
        event = Event.objects.create(
            title='TesT Event',
            description='This is a test event',
            event_date='2021-12-31 23:59:59',
            home_page=True,
            organizer='House of Young',
            venue='Valencia, Spain',
        )

        self.assertEqual(event.title, 'TesT Event')
        # OR
        self.assertEqual(event.title.lower(), 'test event')

        self.assertEqual(event.description, 'This is a test event')
        self.assertEqual(event.event_date, '2021-12-31 23:59:59')
        self.assertTrue(event.home_page)
        self.assertEqual(event.image, 'default.jpg')
        self.assertIsNone(event.sponsor)
        self.assertIsNone(event.collaborator)
        self.assertEqual(event.organizer, 'House of Young')
        self.assertEqual(event.venue, 'Valencia, Spain')
        self.assertEqual(event.tickets_available, 0)
        self.assertEqual(event.qr_code, 'default.jpg')
        self.assertIsNone(event.generate_qr_code('Test Event'))
        self.assertEqual(event.sanitize_filename('Test Event'), 'test-event')
        self.assertEqual(event.slug, 'test-event')
        self.assertTrue(event.is_published)
        self.assertEqual(event.get_absolute_url(), '/event/1/test-event/')


        self.assertEqual(Event._meta.app_label, 'core')
        self.assertEqual(Event._meta.verbose_name_plural, 'Events')
        self.assertEqual(Event._meta.ordering, ('-event_date',))
        self.assertEqual(Event._meta.verbose_name, 'Event')
        self.assertTrue(Event._meta.managed)
        self.assertIsNone(Event._meta.unique_together)
        self.assertIsNone(Event._meta.index_together)
        self.assertEqual(Event._meta.permissions, None)
        self.assertEqual(Event._meta.default_permissions, ('add', 'change', 'delete', 'view'))
        self.assertEqual(Event._meta.get_latest_by, 'event_date')
        self.assertEqual(Event._meta.ordering, ('-event_date',))
        self.assertEqual(Event._meta.app_label, 'core')
        self.assertEqual(Event._meta.db_table, 'core_event')

    if __name__ == '__main__':
        test_event()
        print('All tests passed!')
